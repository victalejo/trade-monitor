import axios from 'axios';
import { config } from '../config/config.js';
import logger from '../utils/logger.js';

class WahaService {
  constructor() {
    this.url = config.waha.url;
    this.apiKey = config.waha.apiKey;
    this.session = config.waha.session;
    this.chatId = config.waha.chatId;

    if (!this.url || !this.chatId) {
      logger.warn('⚠️  WAHA no configurado. No se enviarán notificaciones a WhatsApp.');
    }
  }

  async enviarMensaje(texto) {
    if (!this.url || !this.chatId) {
      return false;
    }

    const data = {
      session: this.session,
      chatId: this.chatId,
      text: texto
    };

    const headers = {
      'Content-Type': 'application/json'
    };

    if (this.apiKey) {
      headers['X-Api-Key'] = this.apiKey;
    }

    try {
      const response = await axios.post(this.url, data, { headers });
      logger.info(`📲 Notificación WhatsApp enviada (${response.status})`);
      return true;
    } catch (error) {
      logger.error('❌ Error enviando notificación WhatsApp:', { message: error.message });
      return false;
    }
  }
}

export default new WahaService();
