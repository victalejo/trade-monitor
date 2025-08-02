// src/utils/database.js
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import logger from './logger.js';

class TradeDatabase {
  constructor() {
    this.db = null;
    this.init();
  }

  async init() {
    try {
      this.db = await open({
        filename: 'data/trades.db',
        driver: sqlite3.Database
      });

      // Crear tabla si no existe
      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS processed_trades (
          id TEXT PRIMARY KEY,
          trade_hash TEXT NOT NULL,
          status TEXT NOT NULL,
          webhook_sent INTEGER DEFAULT 1,
          processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          trade_data TEXT,
          INDEX idx_processed_at (processed_at)
        )
      `);

      // Limpiar trades antiguos
      await this.cleanup();
      
      logger.info('📊 Base de datos inicializada correctamente');
    } catch (error) {
      logger.error('❌ Error inicializando base de datos:', error);
    }
  }

  async isProcessed(tradeId, tradeHash = null) {
    try {
      const result = await this.db.get(
        'SELECT * FROM processed_trades WHERE id = ?',
        [tradeId]
      );

      if (!result) return false;

      // Si hay hash, verificar que coincida
      if (tradeHash && result.trade_hash !== tradeHash) {
        logger.info(`🔄 Trade ${tradeId} cambió (hash diferente), reprocessando`);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error verificando trade procesado:', error);
      return false;
    }
  }

  async markAsProcessed(tradeId, tradeData) {
    try {
      const tradeHash = await this.generateTradeHash(tradeData);
      
      await this.db.run(`
        INSERT OR REPLACE INTO processed_trades 
        (id, trade_hash, status, trade_data) 
        VALUES (?, ?, ?, ?)
      `, [
        tradeId,
        tradeHash,
        tradeData.status,
        JSON.stringify(tradeData)
      ]);

      logger.info(`✅ Trade ${tradeId} guardado en DB (hash: ${tradeHash.substring(0, 8)})`);
    } catch (error) {
      logger.error('Error marcando trade como procesado:', error);
    }
  }

  async generateTradeHash(trade) {
    const crypto = require('crypto');
    const tradeString = JSON.stringify({
      id: trade.id,
      status: trade.status,
      amount: trade.amount,
      openPrice: trade.openPrice,
      createdAt: trade.createdAt
    });
    
    return crypto.createHash('sha256').update(tradeString).digest('hex');
  }

  async cleanup() {
    try {
      // Eliminar trades procesados hace más de 24 horas
      const result = await this.db.run(`
        DELETE FROM processed_trades 
        WHERE processed_at < datetime('now', '-24 hours')
      `);
      
      if (result.changes > 0) {
        logger.info(`🧹 DB limpiada: ${result.changes} trades antiguos eliminados`);
      }
    } catch (error) {
      logger.error('Error limpiando base de datos:', error);
    }
  }

  async getStats() {
    try {
      const total = await this.db.get('SELECT COUNT(*) as count FROM processed_trades');
      const today = await this.db.get(`
        SELECT COUNT(*) as count FROM processed_trades 
        WHERE processed_at > datetime('now', '-24 hours')
      `);
      
      return {
        total: total.count,
        last24h: today.count,
        database: 'SQLite'
      };
    } catch (error) {
      logger.error('Error obteniendo estadísticas:', error);
      return { total: 0, last24h: 0, database: 'Error' };
    }
  }
}

export default new TradeDatabase();