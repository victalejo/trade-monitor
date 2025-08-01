# Trade Monitor Webhook Service

Servicio de monitoreo en tiempo real para detectar trades con estado "OPEN" y disparar webhooks.

## Características

- ✅ Monitoreo continuo de trades
- ✅ Detección de estados OPEN, PROCESSING, PENDING
- ✅ Webhooks con reintentos automáticos
- ✅ Cache para evitar duplicados
- ✅ Logging completo
- ✅ Health checks
- ✅ Docker support
- ✅ API REST para control

## Instalación

```bash
# Clonar repositorio
git clone <repo-url>
cd trade-monitor

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus configuraciones

# Iniciar servicio
npm start