// src/utils/persistentCache.js
import fs from 'fs/promises';
import path from 'path';
import logger from './logger.js';
import { config } from '../config/config.js';

class PersistentTradeCache {
  constructor() {
    this.cacheFile = 'data/processed_trades.json';
    this.cache = new Map();
    this.ttl = config.cache.ttl;
    
    // Asegurar que el directorio existe
    this.ensureDataDirectory();
    
    // Cargar cache desde archivo
    this.loadFromFile();
    
    // Limpieza periódica y guardado
    setInterval(() => {
      this.cleanup();
      this.saveToFile();
    }, 60000); // Cada minuto
  }

  async ensureDataDirectory() {
    try {
      await fs.mkdir('data', { recursive: true });
    } catch (error) {
      logger.error('Error creando directorio data:', error);
    }
  }

  async loadFromFile() {
    try {
      const data = await fs.readFile(this.cacheFile, 'utf8');
      const cacheData = JSON.parse(data);
      
      // Convertir array a Map y validar TTL
      const now = Date.now();
      let loaded = 0;
      
      cacheData.forEach(([key, value]) => {
        if (now - value.timestamp < this.ttl) {
          this.cache.set(key, value);
          loaded++;
        }
      });
      
      logger.info(`📂 Cache cargado: ${loaded} trades desde archivo`);
    } catch (error) {
      logger.debug('📂 No se pudo cargar cache (primera ejecución)');
    }
  }

  async saveToFile() {
    try {
      const cacheArray = Array.from(this.cache.entries());
      await fs.writeFile(this.cacheFile, JSON.stringify(cacheArray, null, 2));
      logger.debug(`💾 Cache guardado: ${this.cache.size} entradas`);
    } catch (error) {
      logger.error('Error guardando cache:', error);
    }
  }

  // Verificar si un trade ya fue procesado
  isProcessed(tradeId, tradeHash = null) {
    const entry = this.cache.get(tradeId);
    
    if (!entry) return false;
    
    // Verificar TTL
    if (Date.now() - entry.timestamp >= this.ttl) {
      this.cache.delete(tradeId);
      return false;
    }
    
    // Si proporcionamos hash, verificar que coincida
    if (tradeHash && entry.hash !== tradeHash) {
      logger.info(`🔄 Trade ${tradeId} cambió, reprocessando`);
      return false;
    }
    
    return true;
  }

  // Marcar trade como procesado con hash de verificación
  async markAsProcessed(tradeId, tradeData = {}) {
    const tradeHash = await this.generateTradeHash(tradeData);
    
    this.cache.set(tradeId, {
      timestamp: Date.now(),
      hash: tradeHash,
      status: tradeData.status,
      webhook_sent: true,
      data: {
        symbol: tradeData.symbol,
        direction: tradeData.direction,
        amount: tradeData.amount,
        status: tradeData.status
      }
    });
    
    logger.info(`✅ Trade ${tradeId} marcado como procesado (hash: ${tradeHash.substring(0, 8)})`);
  }

  // Generar hash único del trade para detectar cambios
  async generateTradeHash(trade) {
    const crypto = await import('crypto');
    const tradeString = JSON.stringify({
      id: trade.id,
      status: trade.status,
      amount: trade.amount,
      openPrice: trade.openPrice,
      createdAt: trade.createdAt
    });
    
    return crypto.createHash('sha256').update(tradeString).digest('hex');
  }

  // Limpiar entradas expiradas
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= this.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.info(`🧹 Cache limpiado: ${cleaned} entradas eliminadas`);
    }
  }

  // Estadísticas mejoradas
  getStats() {
    const now = Date.now();
    let active = 0;
    let expired = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp < this.ttl) {
        active++;
      } else {
        expired++;
      }
    }
    
    return {
      total: this.cache.size,
      active,
      expired,
      ttl: this.ttl,
      cacheFile: this.cacheFile
    };
  }

  // Forzar guardado (útil al cerrar aplicación)
  async forceSave() {
    await this.saveToFile();
    logger.info('💾 Cache guardado forzosamente');
  }
}

export default new PersistentTradeCache();