import apiService from './apiService.js';
import webhookService from './webhookService.js';
import cache from '../utils/cache.js';
import logger from '../utils/logger.js';
import { config } from '../config/config.js';

class TradeMonitor {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.consecutiveErrors = 0;
    this.stats = {
      totalScans: 0,
      tradesProcessed: 0,
      webhooksSent: 0,
      errors: 0,
      startTime: null
    };
  }

  async iniciar() {
    if (this.isRunning) {
      logger.warn('⚠️  Monitor ya está en ejecución');
      return;
    }

    this.isRunning = true;
    this.stats.startTime = new Date();
    
    logger.info('🚀 Iniciando monitor de trades...');
    logger.info(`📊 Configuración: intervalo ${config.monitor.interval}ms, pageSize ${config.api.pageSize}`);
    
    // Primer scan inmediato
    await this.escanearTrades();
    
    // Programar scans periódicos
    this.intervalId = setInterval(() => {
      this.escanearTrades().catch(error => {
        logger.error('Error en scan periódico:', error);
        this.stats.errors++;
      });
    }, config.monitor.interval);

    logger.info('✅ Monitor iniciado correctamente');
  }

  async detener() {
    if (!this.isRunning) {
      logger.warn('⚠️  Monitor no está en ejecución');
      return;
    }

    logger.info('🛑 Deteniendo monitor...');
    
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    logger.info('✅ Monitor detenido');
    this.mostrarEstadisticas();
  }

  async escanearTrades() {
    const startTime = Date.now();
    this.stats.totalScans++;
    
    try {
      logger.debug('🔍 Iniciando scan de trades...');
      
      const resultado = await apiService.obtenerTodasLasPaginas();
      const { trades, totalPaginas, errores } = resultado;
      
      // ⭐ RESETEAR CONTADOR DE ERRORES SI TODO VA BIEN
      this.consecutiveErrors = 0;
      
      // ⭐ FILTRAR TRADES DE INTERÉS (basado en la respuesta real que viste)
      const tradesInteres = trades.filter(trade => {
        // Según tu respuesta, los trades tienen status "COMPLETED", pero necesitamos OPEN/PROCESSING/PENDING
        return ['OPEN', 'PROCESSING', 'PENDING'].includes(trade.status);
      });

      logger.info(`📊 Scan completado: ${trades.length} trades totales, ${tradesInteres.length} de interés, ${totalPaginas} páginas`);

      // ⭐ MOSTRAR ALGUNOS ESTADOS PARA DEBUG
      const estadosEncontrados = [...new Set(trades.map(t => t.status))];
      logger.debug(`📋 Estados encontrados: ${estadosEncontrados.join(', ')}`);

      if (tradesInteres.length > 0) {
        await this.procesarTradesDeInteres(tradesInteres);
      } else {
        logger.debug('ℹ️  No se encontraron trades con estado OPEN/PROCESSING/PENDING');
      }

      if (errores > 0) {
        this.stats.errors += errores;
      }

      const duration = Date.now() - startTime;
      logger.debug(`⏱️  Scan completado en ${duration}ms`);

    } catch (error) {
      logger.error('❌ Error en scan de trades:', error.message);
      this.manejarError(error);
    }
  }

  manejarError(error) {
    this.consecutiveErrors++;
    this.stats.errors++;
    
    logger.error(`❌ Error consecutivo #${this.consecutiveErrors}: ${error.message}`);
    
    // Si hay muchos errores consecutivos, podríamos implementar backoff exponencial
    if (this.consecutiveErrors >= 5) {
      logger.warn('⚠️  Muchos errores consecutivos detectados. Considera revisar la conexión.');
    }
  }

  async procesarTradesDeInteres(trades) {
    logger.info(`🎯 Procesando ${trades.length} trades de interés...`);

    for (const trade of trades) {
      try {
        // Verificar si ya procesamos este trade
        if (cache.isProcessed(trade.id)) {
          logger.debug(`⏭️  Trade ${trade.id} ya procesado, omitiendo`);
          continue;
        }

        // Logear el trade encontrado
        logger.info(`🔔 Trade encontrado:`, {
          id: trade.id,
          status: trade.status,
          symbol: trade.symbol,
          direction: trade.direction,
          amount: trade.amount,
          isDemo: trade.isDemo,
          result: trade.result
        });

        // Determinar tipo de evento
        let tipoEvento = 'TRADE_OPEN';
        if (trade.status === 'PROCESSING') {
          tipoEvento = 'TRADE_PROCESSING';
        } else if (trade.status === 'PENDING') {
          tipoEvento = 'TRADE_PENDING';
        }

        // Enviar webhook
        const resultadoWebhook = await webhookService.enviarConReintentos(
          trade, 
          tipoEvento, 
          config.monitor.maxRetries
        );

        if (resultadoWebhook.success) {
          this.stats.webhooksSent++;
          cache.markAsProcessed(trade.id, trade);
          logger.info(`✅ Webhook enviado exitosamente para trade ${trade.id}`);
        } else {
          logger.error(`❌ Falló webhook para trade ${trade.id}`);
        }

        this.stats.tradesProcessed++;

      } catch (error) {
        logger.error(`❌ Error procesando trade ${trade.id}:`, error);
        this.stats.errors++;
      }
    }
  }

  obtenerEstadisticas() {
    const uptime = this.stats.startTime ? Date.now() - this.stats.startTime.getTime() : 0;
    
    return {
      ...this.stats,
      uptime: Math.floor(uptime / 1000), // en segundos
      isRunning: this.isRunning,
      cache: cache.getStats()
    };
  }

  mostrarEstadisticas() {
    const stats = this.obtenerEstadisticas();
    
    logger.info('📊 Estadísticas del Monitor:');
    logger.info(`   Total de scans: ${stats.totalScans}`);
    logger.info(`   Trades procesados: ${stats.tradesProcessed}`);
    logger.info(`   Webhooks enviados: ${stats.webhooksSent}`);
    logger.info(`   Errores: ${stats.errors}`);
    logger.info(`   Tiempo activo: ${Math.floor(stats.uptime / 60)}m ${stats.uptime % 60}s`);
    logger.info(`   Cache: ${stats.cache.size} entradas`);
  }
}

export default new TradeMonitor();