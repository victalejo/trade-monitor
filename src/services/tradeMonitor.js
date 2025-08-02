import apiService from './apiService.js';
import webhookService from './webhookService.js';
import simpleCache from '../utils/cache.js'; // ⭐ CACHE SIMPLE
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
    
    logger.info('🚀 Monitor de trades iniciado');
    logger.debug(`📊 Configuración: intervalo ${config.monitor.interval}ms, pageSize ${config.api.pageSize}`);
    
    // Primer scan inmediato
    await this.escanearTrades();
    
    // Programar scans periódicos
    this.intervalId = setInterval(() => {
      this.escanearTrades().catch(error => {
        logger.error('Error en scan periódico:', error);
        this.stats.errors++;
      });
    }, config.monitor.interval);

    logger.debug('✅ Monitor iniciado correctamente');
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

      logger.debug(`📊 Scan completado: ${trades.length} trades totales, ${tradesInteres.length} de interés, ${totalPaginas} páginas`);

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
    logger.debug(`🎯 Procesando ${trades.length} trades de interés...`);

    for (const trade of trades) {
      try {
        // ⭐ VERIFICACIÓN SIMPLE: SOLO ID
        if (simpleCache.isProcessed(trade.id)) {
          logger.debug(`⏭️  Trade ${trade.id} ya procesado, omitiendo`);
          continue;
        }

        logger.debug(`🔔 Trade NUEVO encontrado:`, {
          id: trade.id,
          status: trade.status,
          symbol: trade.symbol,
          direction: trade.direction
        });

        // ⭐ ENVIAR WEBHOOK SOLO SI NO FUE PROCESADO
        const tipoEvento = this.determinarTipoEvento(trade);
        const resultadoWebhook = await webhookService.enviarConReintentos(
          trade, 
          tipoEvento, 
          config.monitor.maxRetries
        );

        if (resultadoWebhook.success) {
          // ⭐ MARCAR COMO PROCESADO SOLO SI WEBHOOK EXITOSO
          simpleCache.markAsProcessed(trade.id);
          this.stats.webhooksSent++;
          logger.debug(`✅ Trade ${trade.id} procesado completamente`);
        } else {
          logger.error(`❌ Webhook falló para trade ${trade.id}, NO marcando como procesado`);
        }

        this.stats.tradesProcessed++;

      } catch (error) {
        logger.error(`❌ Error procesando trade ${trade.id}:`, error);
        this.stats.errors++;
      }
    }
  }

  determinarTipoEvento(trade) {
    const eventMap = {
      'OPEN': 'TRADE_OPEN',
      'PROCESSING': 'TRADE_PROCESSING', 
      'PENDING': 'TRADE_PENDING'
    };
    return eventMap[trade.status] || 'TRADE_UNKNOWN';
  }

  obtenerEstadisticas() {
    const uptime = this.stats.startTime ? Date.now() - this.stats.startTime.getTime() : 0;
    
    return {
      ...this.stats,
      uptime: Math.floor(uptime / 1000), // en segundos
      isRunning: this.isRunning,
      cache: simpleCache.getStats()
    };
  }

  mostrarEstadisticas() {
    const stats = this.obtenerEstadisticas();
    
    logger.debug('📊 Estadísticas del Monitor:');
    logger.debug(`   Total de scans: ${stats.totalScans}`);
    logger.debug(`   Trades procesados: ${stats.tradesProcessed}`);
    logger.debug(`   Webhooks enviados: ${stats.webhooksSent}`);
    logger.debug(`   Errores: ${stats.errors}`);
    logger.debug(`   Tiempo activo: ${Math.floor(stats.uptime / 60)}m ${stats.uptime % 60}s`);
    logger.debug(`   Cache: ${stats.cache.total} entradas`);
  }

  // ⭐ LIMPIEZA AL CERRAR
  async detener() {
    if (!this.isRunning) return;

    logger.info('🛑 Monitor detenido');
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // ⭐ GUARDAR CACHE
    await simpleCache.forceSave();
    logger.debug('✅ Cache guardado al detener monitor');
  }
}

export default new TradeMonitor();