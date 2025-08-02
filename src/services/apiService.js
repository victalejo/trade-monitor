import axios from 'axios';
import { config } from '../config/config.js';
import logger from '../utils/logger.js';

class ApiService {
  constructor() {
    this.client = axios.create({
      baseURL: config.api.baseUrl,
      timeout: config.api.timeout,
      maxRedirects: 0, // ⭐ NO SEGUIR REDIRECTS
      validateStatus: function (status) {
        return status >= 200 && status < 300; // ⭐ SOLO 2XX SON VÁLIDOS
      },
      headers: {
        'api-token': config.api.token,
        'Accept': 'application/json', // ⭐ HEADER ESPECÍFICO
        'User-Agent': 'TradeMonitor/1.0' // ⭐ USER AGENT
      }
    });

    // Interceptor para debugging
    this.client.interceptors.request.use(
      (config) => {
        logger.info(`🔄 API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url || ''}`);
        logger.debug(`🔑 Headers:`, JSON.stringify(config.headers, null, 2));
        logger.debug(`📊 Params:`, JSON.stringify(config.params, null, 2));
        return config;
      },
      (error) => {
        logger.error('❌ API Request Error:', error.message);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.info(`✅ API Response: ${response.status} - ${response.data?.data?.length || 0} trades recibidos`);
        return response;
      },
      (error) => {
        logger.error('❌ API Response Error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url,
          message: error.message,
          data: error.response?.data
        });
        return Promise.reject(error);
      }
    );
  }

  async verificarToken() {
    try {
      logger.info('🔍 Verificando token de API...');
      
      // ⭐ HACER REQUEST EXACTAMENTE COMO EN POSTMAN
      const response = await this.client.get('', {
        params: { 
          page: 1, 
          pageSize: 10 
        }
      });
      
      // ⭐ VERIFICAR ESTRUCTURA DE RESPUESTA
      if (response.data && typeof response.data.currentPage !== 'undefined') {
        logger.info('✅ Token válido - API respondió correctamente');
        logger.info(`📊 Página ${response.data.currentPage}/${response.data.lastPage}, ${response.data.data?.length} trades`);
        return true;
      } else {
        logger.error('❌ Respuesta inesperada de la API');
        return false;
      }
    } catch (error) {
      logger.error('❌ Error verificando token:', error.message);
      return false;
    }
  }

  async obtenerTrades(pagina = 1) {
    try {
      // ⭐ REQUEST EXACTAMENTE IGUAL QUE POSTMAN
      const response = await this.client.get('', {
        params: {
          page: pagina,
          pageSize: config.api.pageSize
        }
      });

      // ⭐ VALIDAR ESTRUCTURA
      if (!response.data || !Array.isArray(response.data.data)) {
        throw new Error('Respuesta de API no tiene la estructura esperada');
      }

      logger.debug(`📄 Página ${pagina}: ${response.data.data.length} trades obtenidos`);
      return response.data;
    } catch (error) {
      logger.error(`❌ Error obteniendo trades página ${pagina}:`, error.message);
      throw error;
    }
  }

  async obtenerTodasLasPaginas() {
    try {
      // ⭐ VERIFICAR TOKEN PRIMERO
      const tokenValido = await this.verificarToken();
      if (!tokenValido) {
        throw new Error('Token de API inválido o respuesta inesperada');
      }

      const primeraPagina = await this.obtenerTrades(1);
      const totalPaginas = primeraPagina.lastPage || 1;
      
      logger.info(`📊 Iniciando scan completo: ${totalPaginas} páginas, ${primeraPagina.count} trades totales`);

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