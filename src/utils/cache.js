// src/utils/cache.js
import fs from 'fs/promises';
import logger from './logger.js';

class SimpleTradeCache {
  constructor() {
    this.processedTrades = new Set();
    this.cacheFile = 'data/processed_trades.txt';
    this.loadCache();
    
    // Guardar cada 30 segundos
    setInterval(() => this.saveCache(), 30000);
  }

  async loadCache() {
    try {
      const data = await fs.readFile(this.cacheFile, 'utf8');
      const trades = data.split('\n').filter(line => line.trim());
      trades.forEach(tradeId => this.processedTrades.add(tradeId));
      logger.info(`📂 Cache cargado: ${this.processedTrades.size} trades procesados`);
    } catch (error) {
      logger.info('📂 Iniciando con cache vacío');
    }
  }

  async saveCache() {
    try {
      await fs.mkdir('data', { recursive: true });
      const data = Array.from(this.processedTrades).join('\n');
      await fs.writeFile(this.cacheFile, data);
      logger.debug(`💾 Cache guardado: ${this.processedTrades.size} trades`);
    } catch (error) {
      logger.error('Error guardando cache:', error);
    }
  }

  isProcessed(tradeId) {
    return this.processedTrades.has(tradeId);
  }

  markAsProcessed(tradeId) {
    this.processedTrades.add(tradeId);
    logger.info(`✅ Trade ${tradeId} marcado como procesado`);
  }

  getStats() {
    return {
      total: this.processedTrades.size,
      cacheFile: this.cacheFile
    };
  }

  async forceSave() {
    await this.saveCache();
  }
}

export default new SimpleTradeCache();