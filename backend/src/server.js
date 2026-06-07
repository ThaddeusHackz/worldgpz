import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from './config/config.js';
import { logger } from './utils/logger.js';

// Routes
import apiRoutes from './routes/api.routes.js';
import dataRoutes from './routes/data.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import authRoutes from './routes/auth.routes.js';

// Controllers
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
      imgSrc: ["'self'", "data:", "https://*.tile.openstreetmap.org", "https://*.basemaps.cartocdn.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// CORS
app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Compression
app.use(compression());

// Logging
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim()),
  },
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files (for production)
app.use(express.static('public'));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    environment: config.nodeEnv,
  });
});

// API Routes
app.use('/api/v1', apiRoutes);
app.use('/api/v1/data', dataRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/auth', authRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    message: '🌍 WORLDGPZ API - Global Monitoring Dashboard',
    version: '1.0.0',
    documentation: '/api/v1/docs',
    endpoints: {
      health: '/health',
      api: '/api/v1',
      data: '/api/v1/data',
      analytics: '/api/v1/analytics',
      auth: '/api/v1/auth',
    },
    createdBy: 'ThaddeusTechz',
    documentation: {
      endpoints: {
        conflicts: 'GET /api/v1/data/conflicts',
        weather: 'GET /api/v1/data/weather',
        military: 'GET /api/v1/data/military',
        economic: 'GET /api/v1/data/economic',
        mapData: 'GET /api/v1/data/map?lat=&lng=&radius=',
        analytics: 'GET /api/v1/analytics/overview',
        trends: 'GET /api/v1/analytics/trends',
      }
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    suggestion: 'Please check the API documentation at /api/v1/docs',
  });
});

// Error handler
app.use(errorHandler);

// Start server
const PORT = config.port || 5000;

const server = app.listen(PORT, () => {
  logger.info(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║   🌍 WORLDGPZ Backend Server Started Successfully!       ║
  ║                                                           ║
  ║   Environment: ${config.nodeEnv.padEnd(40)}║
  ║   Port: ${PORT.toString().padEnd(46)}║
  ║   API Version: 1.0.0                                       ║
  ║                                                           ║
  ║   Created by: ThaddeusTechz                               ║
  ║   © 2024 WORLDGPZ - All Rights Reserved                   ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed.');
    process.exit(0);
  });
});

// Unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

export default app;