import axios from 'axios';
import { config } from './src/config/config.js';

async function debugApi() {
  console.log('🔍 Debug API - Comparando con Postman\n');
  
  // ⭐ CONFIGURACIÓN EXACTA DE POSTMAN
  const postmanConfig = {
    method: 'GET',
    url: 'https://api.zaffex.com/token/trades',  // ⭐ URL COMPLETA, NO baseURL
    params: {
      page: 1,
      pageSize: 100
    },
    headers: {
      'api-token': '0brngk9fk2'  // ⭐ SOLO EL HEADER QUE FUNCIONA
    },
    maxRedirects: 5,  // ⭐ PERMITIR REDIRECTS COMO POSTMAN
    timeout: 10000
  };

  try {
    console.log('📤 Enviando request igual que Postman...');
    console.log('URL:', postmanConfig.url);
    console.log('Params:', postmanConfig.params);
    console.log('Headers:', postmanConfig.headers);
    console.log('');

    const response = await axios(postmanConfig);
    
    console.log('✅ ¡ÉXITO! Response recibida:');
    console.log('Status:', response.status);
    console.log('Pages:', response.data.lastPage);
    console.log('Total trades:', response.data.count);
    console.log('Trades en esta página:', response.data.data?.length);
    console.log('');
    
    // Mostrar algunos trades
    if (response.data.data?.length > 0) {
      console.log('📊 Primeros 3 trades:');
      response.data.data.slice(0, 3).forEach((trade, i) => {
        console.log(`${i+1}. ID: ${trade.id}, Status: ${trade.status}, Symbol: ${trade.symbol}`);
      });
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Error:');
    console.error('Message:', error.message);
    console.error('Status:', error.response?.status);
    console.error('StatusText:', error.response?.statusText);
    console.error('Headers:', error.response?.headers);
    console.error('Data:', error.response?.data);
    
    return false;
  }
}

// Ejecutar debug
debugApi();