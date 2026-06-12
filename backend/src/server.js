const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const passwordResetRoutes = require('./routes/passwordReset');
const usuariosRoutes = require('./routes/usuarios');
const insumosRoutes = require('./routes/insumos');
const lotesRoutes = require('./routes/lotes');
const consumosRoutes = require('./routes/consumos');
const ganadoRoutes = require('./routes/ganado');
const alertasRoutes = require('./routes/alertas');
const dietasRoutes = require('./routes/dietas');
const movimientosRoutes = require('./routes/movimientos');
const actividadesRoutes = require('./routes/actividades');

const app = express();

const isProduction = process.env.NODE_ENV === 'production';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 100 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones, intente nuevamente en 15 minutos' },
  skip: (req) => {
    const host = req.hostname || req.ip;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 20 : 100,
  message: { error: 'Demasiados intentos de autenticación' }
});

app.use(helmet({
  contentSecurityPolicy: isProduction ? undefined : false,
  crossOriginEmbedderPolicy: false
}));
app.use(compression({ threshold: 1024 }));
app.use(limiter);

const corsOptions = {
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

if (isProduction) {
  const envOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map(origin => origin.trim())
    : [];

  const allowedOrigins = [
    ...envOrigins,
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'https://localhost:3001',
    'https://127.0.0.1:3001'
  ];

  corsOptions.origin = function (origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    if (origin.endsWith('.ngrok-free.dev') || origin.endsWith('.trycloudflare.com')) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  };
} else {
  corsOptions.origin = function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
      'http://192.168.1.244:5173',
      'http://192.168.1.244:5174',
      'http://192.168.1.244:5175'
    ];

    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    if (origin.endsWith('.ngrok-free.dev') || origin.endsWith('.trycloudflare.com')) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  };
}

app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/auth', passwordResetRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/insumos', insumosRoutes);
app.use('/api/lotes', lotesRoutes);
app.use('/api/consumos', consumosRoutes);
app.use('/api/ganado', ganadoRoutes);
app.use('/api/alertas', alertasRoutes);
app.use('/api/dietas', dietasRoutes);
app.use('/api/movimientos', movimientosRoutes);
app.use('/api/actividades', actividadesRoutes);

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

app.get('/api/metrics', (req, res) => {
  res.json({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    nodeVersion: process.version,
    platform: process.platform,
    timestamp: new Date().toISOString()
  });
});

const publicPath = path.join(__dirname, '../public');
const hasPublic = fs.existsSync(publicPath);

if (hasPublic) {
  app.use(express.static(publicPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(publicPath, 'index.html'));
  });
} else if (isProduction) {
  console.warn('Advertencia: no se encontró el directorio public. Asegúrate de compilar el frontend.');
}

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
  console.log(`Acceso local: http://localhost:${PORT}`);
  console.log(`Acceso red: http://192.168.1.244:${PORT}`);
});

module.exports = app;
