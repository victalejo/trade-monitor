FROM node:18-alpine

# Directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar código fuente
COPY . .

# Crear directorios con permisos correctos
RUN mkdir -p logs data
RUN chmod 755 logs data

# Usuario no-root por seguridad
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# ⭐ IMPORTANTE: Dar permisos DESPUÉS de crear el usuario
RUN chown -R nodejs:nodejs /app
RUN chmod -R 755 /app/data
RUN chmod -R 755 /app/logs

USER nodejs

# Puerto para health checks
EXPOSE 3000

# Comando de inicio
CMD ["node", "src/app.js"]