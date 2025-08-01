import axios from 'axios';
import crypto from 'crypto';
import { config } from '../config/config.js';
import logger from '../utils/logger.js';

class WebhookService {
  constructor() {
    this.webhookUrl = config.webhook.url;
    this.secret = config.webhook.secret;
    this.timeout = config.webhook.timeout;
    
    if (!this.webhookUrl) {
      logger.warn('⚠️  WEBHOOK_URL no configurada. Los webhooks no se enviarán.');
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
          createdAt: trade.createdAt,
          isDemo: trade.isDemo,
          fromBot: trade.fromBot,
          result: trade.result,
          userId: trade.userId
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
      logger.info(`📡 Enviando webhook para trade ${trade.id} (${tipo})`);
      
      const response = await axios.post(this.webhookUrl, payload, {
        headers,
        timeout: this.timeout
      });

      logger.info(`✅ Webhook enviado exitosamente para trade ${trade.id}: ${response.status}`);
      
      return {
        success: true,
        status: response.status,
        tradeId: trade.id
      };

    } catch (error) {
      logger.error(`❌ Error enviando webhook para trade ${trade.id}:`, {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });

      return {
        success: false,
        error: error.message,
        tradeId: trade.id
      };
    }
  }

  // Enviar webhook con reintentos
  async enviarConReintentos(trade, tipo = 'TRADE_OPEN', maxReintentos = 3) {
    let intento = 1;
    
    while (intento <= maxReintentos) {
      const resultado = await this.enviarWebhook(trade, tipo);
      
      if (resultado.success) {
        return resultado;
      }
      
      if (intento < maxReintentos) {
        const delay = Math.pow(2, intento) * 1000; // Backoff exponencial
        logger.info(`🔄 Reintentando webhook en ${delay}ms (intento ${intento + 1}/${maxReintentos})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      intento++;
    }

    logger.error(`❌ Webhook falló después de ${maxReintentos} intentos para trade ${trade.id}`);
    return { success: false, error: 'Max reintentos alcanzado' };
  }
}

export default new WebhookService();