#!/usr/bin/env node

import express from 'express';
import tradeMonitor from './services/tradeMonitor.js';
import logger from './utils/logger.js';
import { config } from './config/config.js';

// Crear servidor express para health checks
const app = express();
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  const stats = tradeMonitor.obtenerEstadisticas();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    monitor: stats
  });
});

// Endpoint para obtener estadísticas
app.get('/stats', (req, res) => {
  const stats = tradeMonitor.obtenerEstadisticas();
  res.json(stats);
});

// Endpoint para control manual
app.post('/control/:action', (req, res) => {
  const { action } = req.params;
  
  switch (action) {
    case 'start':
      tradeMonitor.iniciar();
      res.json({ message: 'Monitor iniciado' });
      break;
    case 'stop':
      tradeMonitor.detener();
      res.json({ message: 'Monitor detenido' });
      break;
    case 'restart':
      tradeMonitor.detener();
      setTimeout(() => tradeMonitor.iniciar(), 1000);
      res.json({ message: 'Monitor reiniciado' });
      break;
    default:
      res.status(400).json({ error: 'Acción no válida' });
  }
});

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Manejo de señales de sistema
process.on('SIGTERM', async () => {
  logger.info('📡 SIGTERM recibido, cerrando aplicación...');
  await tradeMonitor.detener();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('📡 SIGINT recibido, cerrando aplicación...');
  await tradeMonitor.detener();
  process.exit(0);
});

// Función principal
async function main() {
  try {
    logger.info('🚀 Iniciando Trade Monitor Service...');
    
    // Verificar configuración crítica
    if (!config.webhook.url) {
      logger.warn('⚠️  WEBHOOK_URL no configurada');
    }
    
    // Iniciar servidor HTTP
    const server = app.listen(config.healthCheck.port, () => {
      logger.info(`🌐 Servidor HTTP iniciado en puerto ${config.healthCheck.port}`);
      logger.info(`   Health check: http://localhost:${config.healthCheck.port}/health`);
      logger.info(`   Stats: http://localhost:${config.healthCheck.port}/stats`);
    });

    // Iniciar monitor
    await tradeMonitor.iniciar();
    
    logger.info('✅ Trade Monitor Service iniciado correctamente');

  } catch (error) {
    logger.error('❌ Error iniciando aplicación:', error);
    process.exit(1);
  }
}

// Ejecutar aplicación
main();