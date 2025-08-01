import dotenv from 'dotenv';

dotenv.config();

export const config = {
  api: {
    token: process.env.API_TOKEN || '0brngk9fk2',
    baseUrl: process.env.API_BASE_URL || 'https://api.zaffex.com/token/trades',
    timeout: parseInt(process.env.API_TIMEOUT) || 10000,
    pageSize: parseInt(process.env.PAGE_SIZE) || 1000
  },
  monitor: {
    interval: parseInt(process.env.MONITOR_INTERVAL) || 5000, // 5 segundos
    maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
    retryDelay: parseInt(process.env.RETRY_DELAY) || 2000
  },
  webhook: {
    url: process.env.WEBHOOK_URL,
    timeout: parseInt(process.env.WEBHOOK_TIMEOUT) || 5000,
    secret: process.env.WEBHOOK_SECRET
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/trade-monitor.log'
  },
  healthCheck: {
    port: parseInt(process.env.HEALTH_CHECK_PORT) || 3000
  },
  cache: {
    ttl: parseInt(process.env.CACHE_TTL) || 300000 // 5 minutos
  }
};