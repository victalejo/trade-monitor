import axios from 'axios';
import { config } from '../config/config.js';
import logger from '../utils/logger.js';

class ApiService {
  constructor() {
    this.client = axios.create({
      baseURL: config.api.baseUrl,
      timeout: config.api.timeout,
      headers: {
        'api-token': config.api.token,
        'Content-Type': 'application/json'
      }
    });

    // Interceptor para logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('API Request Error:', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        logger.error('API Response Error:', {
          status: error.response?.status,
          url: error.config?.url,
          message: error.message
        });
        return Promise.reject(error);
      }
    );
  }

  async obtenerTrades(pagina = 1) {
    try {
      const response = await this.client.get('', {
        params: {
          page: pagina,
          pageSize: config.api.pageSize
        }
      });

      return response.data;
    } catch (error) {
      logger.error(`Error obteniendo trades página ${pagina}:`, error.message);
      throw error;
    }
  }

  async obtenerTodasLasPaginas() {
    try {
      // Primero obtenemos la primera página para saber el total
      const primeraPagina = await this.obtenerTrades(1);
      const totalPaginas = primeraPagina.lastPage;
      
      logger.info(`Iniciando scan completo: ${totalPaginas} páginas`);

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
          logger.error(`Error en página ${index + 1}:`, resultado.reason.message);
        }
      });

      logger.info(`Scan completado: ${trades.length} trades obtenidos, ${errores} errores`);
      
      return {
        trades,
        totalPaginas,
        errores,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error en scan completo:', error.message);
      throw error;
    }
  }
}

export default new ApiService();