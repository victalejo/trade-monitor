import logger from './logger.js';
import { config } from '../config/config.js';

class TradeCache {
  constructor() {
    this.cache = new Map();
    this.ttl = config.cache.ttl;
    
    // Limpieza periódica del cache
    setInterval(() => {
      this.cleanup();
    }, this.ttl);
  }

  // Verificar si un trade ya fue procesado
  isProcessed(tradeId) {
    const entry = this.cache.get(tradeId);
    if (entry && Date.now() - entry.timestamp < this.ttl) {
      return true;
    }
    return false;
  }

  // Marcar trade como procesado
  markAsProcessed(tradeId, tradeData = {}) {
    this.cache.set(tradeId, {
      timestamp: Date.now(),
      data: tradeData
    });
    logger.debug(`Trade ${tradeId} marcado como procesado`);
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
      logger.debug(`Cache limpiado: ${cleaned} entradas eliminadas`);
    }
  }

  // Obtener estadísticas del cache
  getStats() {
    return {
      size: this.cache.size,
      ttl: this.ttl
    };
  }
}

export default new TradeCache();