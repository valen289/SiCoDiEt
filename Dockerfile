# ==========================================
# SiCoDiEt - Dockerfile de producción
# ==========================================

FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --ignore-scripts
COPY frontend/ .
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY backend/package.json backend/package-lock.json* ./
RUN npm install --omit=dev --ignore-scripts
COPY backend/src/ ./src/
COPY --from=frontend-builder /app/frontend/dist ./public
EXPOSE 3001
CMD ["node", "src/server.js"]
