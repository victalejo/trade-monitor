// src/utils/cache.js - SOLO MEMORIA, NADA DE ARCHIVOS
import logger from './logger.js';

class SimpleMemoryCache {
  constructor() {
    this.processedTrades = new Set();
    this.stats = {
      processed: 0,
      startTime: Date.now()
    };
    
    logger.info('💾 Cache en memoria inicializado');
  }

  isProcessed(tradeId) {
    return this.processedTrades.has(tradeId);
  }

  markAsProcessed(tradeId) {
    if (!this.processedTrades.has(tradeId)) {
      this.processedTrades.add(tradeId);
      this.stats.processed++;
      logger.info(`✅ Trade ${tradeId} marcado como procesado`);
    }
  }

  getStats() {
    return {
      total: this.processedTrades.size,
      processed: this.stats.processed,
      uptime: Math.floor((Date.now() - this.stats.startTime) / 1000)
    };
  }

  // Método dummy para compatibilidad
  async forceSave() {
    logger.debug('💾 Cache en memoria - no requiere guardado');
  }

  // Limpiar cache viejo cada hora
  cleanup() {
    if (this.processedTrades.size > 10000) {
      logger.info('🧹 Limpiando cache - muy grande');
      this.processedTrades.clear();
    }
  }
}

export default new SimpleMemoryCache();