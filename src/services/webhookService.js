import axios from 'axios';
import crypto from 'crypto';
import { config } from '../config/config.js';
import logger from '../utils/logger.js';

class WebhookService {
  constructor() {
    this.webhookUrl = config.webhook.url;
    this.secret = config.webhook.secret;
    this.timeout = config.webhook.timeout;
    
    // Crear cliente axios específico para webhooks
    this.client = axios.create({
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'TradeMonitor/1.0'
      }
    });
    
    if (!this.webhookUrl) {
      logger.warn('⚠️  WEBHOOK_URL no configurada. Los webhooks no se enviarán.');
    } else {
      logger.info(`📡 Webhook configurado: ${this.webhookUrl}`);
    }
  }

  // Crear firma HMAC para seguridad
  crearFirma(payload) {
    if (!this.secret) return null;
    
    return crypto
      .createHmac('sha256', this.secret)
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  async enviarWebhook(trade, tipo = 'TRADE_OPEN') {
    if (!this.webhookUrl) {
      logger.warn('Webhook no enviado: URL no configurada');
      return false;
    }

    const payload = {
      event: tipo,
      timestamp: new Date().toISOString(),
      data: {
        trade: {
          id: trade.id,
          status: trade.status,
          symbol: trade.symbol,
          direction: trade.direction,
          amount: trade.amount,
          openPrice: trade.openPrice,
          closePrice: trade.closePrice,
          createdAt: trade.createdAt,
          isDemo: trade.isDemo,
          fromBot: trade.fromBot,
          result: trade.result,
          userId: trade.userId,
          pnl: trade.pnl
        }
      }
    };

    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'TradeMonitor/1.0'
    };

    // Agregar firma si hay secret configurado
    const firma = this.crearFirma(payload);
    if (firma) {
      headers['X-Webhook-Signature'] = `sha256=${firma}`;
    }

    try {
      logger.info(`📡 Enviando webhook POST para trade ${trade.id} (${tipo})`);
      logger.debug('📋 Payload del webhook:', JSON.stringify(payload, null, 2));
      
      // ✅ CORRECCIÓN: Usar POST correctamente
      const response = await this.client.post(this.webhookUrl, payload, {
        headers
      });

      logger.info(`✅ Webhook POST enviado exitosamente para trade ${trade.id}: ${response.status}`);
      logger.debug('📨 Respuesta del webhook:', response.data);
      
      return {
        success: true,
        status: response.status,
        tradeId: trade.id,
        response: response.data
      };

    } catch (error) {
      logger.error(`❌ Error enviando webhook POST para trade ${trade.id}:`, {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: this.webhookUrl
      });

      return {
        success: false,
        error: error.message,
        status: error.response?.status,
        tradeId: trade.id
      };
    }
  }

  // Enviar webhook con reintentos
  async enviarConReintentos(trade, tipo = 'TRADE_OPEN', maxReintentos = 3) {
    let intento = 1;
    
    while (intento <= maxReintentos) {
      logger.info(`🔄 Intento ${intento}/${maxReintentos} - Enviando webhook para trade ${trade.id}`);
      
      const resultado = await this.enviarWebhook(trade, tipo);
      
      if (resultado.success) {
        logger.info(`✅ Webhook enviado exitosamente en intento ${intento}`);
        return resultado;
      }
      
      if (intento < maxReintentos) {
        const delay = Math.pow(2, intento) * 1000; // Backoff exponencial: 2s, 4s, 8s
        logger.warn(`⏳ Reintentando webhook en ${delay}ms (intento ${intento + 1}/${maxReintentos})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      intento++;
    }

    logger.error(`❌ Webhook falló después de ${maxReintentos} intentos para trade ${trade.id}`);
    return { 
      success: false, 
      error: 'Max reintentos alcanzado',
      attempts: maxReintentos
    };
  }

  // ✅ NUEVO: Método para probar el webhook
  async probarWebhook() {
    if (!this.webhookUrl) {
      logger.error('❌ No se puede probar webhook: URL no configurada');
      return false;
    }

    const tradeTest = {
      id: `TEST_${Date.now()}`,
      status: 'OPEN',
      symbol: 'BTCUSDT',
      direction: 'BUY',
      amount: 1,
      openPrice: 115000,
      closePrice: 0,
      createdAt: new Date().toISOString(),
      isDemo: true,
      fromBot: false,
      result: 'OPEN',
      userId: 'test_user_monitor',
      pnl: 0
    };

    logger.info('🧪 Enviando webhook de prueba...');
    const resultado = await this.enviarWebhook(tradeTest, 'TRADE_TEST');
    
    if (resultado.success) {
      logger.info('✅ Webhook de prueba enviado exitosamente');
      return true;
    } else {
      logger.error('❌ Webhook de prueba falló:', resultado.error);
      return false;
    }
  }

  // ✅ NUEVO: Obtener configuración actual
  getConfig() {
    return {
      url: this.webhookUrl,
      timeout: this.timeout,
      hasSecret: !!this.secret,
      configured: !!this.webhookUrl
    };
  }
}

export default new WebhookService();