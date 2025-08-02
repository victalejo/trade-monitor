import axios from 'axios';
import { config } from '../config/config.js';
import logger from '../utils/logger.js';

class ApiService {
  constructor() {
    this.client = axios.create({
      baseURL: config.api.baseUrl,
      timeout: config.api.timeout,
      maxRedirects: 0, // ⭐ NO SEGUIR REDIRECTS PARA DETECTAR ERRORES
      headers: {
        'api-token': config.api.token,
        'Content-Type': 'application/json'
      }
    });

    // Interceptor mejorado
    this.client.interceptors.request.use(
      (config) => {
        logger.info(`🔄 API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url || ''}`);
        logger.debug(`🔑 Token usado: ${config.headers['api-token']?.substring(0, 8)}...`);
        return config;
      },
      (error) => {
        logger.error('❌ API Request Error:', error.message);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.info(`✅ API Response: ${response.status} - Datos recibidos correctamente`);
        return response;
      },
      (error) => {
        // ⭐ DETECTAR PROBLEMA DE AUTENTICACIÓN
        if (error.response?.status === 401) {
          logger.error('🔐 ERROR CRÍTICO: Token de API inválido o expirado');
          logger.error('   Verifica tu API_TOKEN en el archivo .env');
        } else if (error.response?.status === 302 || error.response?.status === 301) {
          logger.error('🔄 ERROR: La API está redirigiendo, posible problema de autenticación');
          logger.error(`   Location header: ${error.response?.headers?.location}`);
        }
        
        logger.error('❌ API Response Error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url,
          message: error.message
        });
        return Promise.reject(error);
      }
    );
  }

  async verificarToken() {
    try {
      logger.info('🔍 Verificando token de API...');
      const response = await this.client.get('', {
        params: { page: 1, pageSize: 1 }
      });
      
      logger.info('✅ Token válido - API respondió correctamente');
      return true;
    } catch (error) {
      if (error.response?.status === 401) {
        logger.error('❌ Token inválido - Error 401 Unauthorized');
      } else {
        logger.error('❌ Error verificando token:', error.message);
      }
      return false;
    }
  }

  async obtenerTrades(pagina = 1) {
    try {
      const response = await this.client.get('', {
        params: {
          page: pagina,
          pageSize: config.api.pageSize
        }
      });

      // ⭐ VALIDAR ESTRUCTURA DE RESPUESTA
      if (!response.data || !response.data.data) {
        throw new Error('Respuesta de API no tiene la estructura esperada');
      }

      return response.data;
    } catch (error) {
      logger.error(`❌ Error obteniendo trades página ${pagina}:`, error.message);
      throw error;
    }
  }

  async obtenerTodasLasPaginas() {
    try {
      // ⭐ VERIFICAR TOKEN ANTES DE CONTINUAR
      const tokenValido = await this.verificarToken();
      if (!tokenValido) {
        throw new Error('Token de API inválido. Verifica tu configuración.');
      }

      const primeraPagina = await this.obtenerTrades(1);
      const totalPaginas = primeraPagina.lastPage || 1;
      
      logger.info(`📊 Token válido - Iniciando scan de ${totalPaginas} páginas`);

      const promesas = [];
      for (let pagina = 1; pagina <= totalPaginas; pagina++) {
        promesas.push(this.obtenerTrades(pagina));
      }

      const resultados = await Promise.allSettled(promesas);
      
      const trades = [];
      let errores = 0;

      resultados.forEach((resultado, index) => {
        if (resultado.status === 'fulfilled') {
          trades.push(...(resultado.value.data || []));
        } else {
          errores++;
          logger.error(`❌ Error en página ${index + 1}:`, resultado.reason.message);
        }
      });

      logger.info(`📈 Scan completado: ${trades.length} trades obtenidos, ${errores} errores`);
      
      return {
        trades,
        totalPaginas,
        errores,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('❌ Error en scan completo:', error.message);
      throw error;
    }
  }
}

export default new ApiService();