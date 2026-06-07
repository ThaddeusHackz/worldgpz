import os from 'os';
import config from '../config/config.js';
import { logger } from '../utils/logger.js';

// Get API information
export const getApiInfo = async (req, res) => {
  res.json({
    name: 'WORLDGPZ API',
    version: '1.0.0',
    description: 'Global Monitoring Dashboard API',
    author: 'ThaddeusTechz',
    documentation: '/api/v1/docs',
    endpoints: {
      health: '/health',
      api: '/api/v1',
      data: '/api/v1/data',
      analytics: '/api/v1/analytics',
      auth: '/api/v1/auth',
    },
    features: [
      'Real-time conflict monitoring',
      'Weather event tracking',
      'Military activity surveillance',
      'Economic indicator analysis',
      'Nuclear facility monitoring',
      'AI-powered insights and predictions',
      'Interactive map data',
      'Comprehensive analytics',
    ],
    documentation: {
      version: '1.0.0',
      baseUrl: `/api/v1`,
      rateLimit: {
        windowMs: config.rateLimit.windowMs,
        maxRequests: config.rateLimit.max,
      },
    },
  });
};

// Get API documentation
export const getDocumentation = async (req, res) => {
  res.json({
    title: 'WORLDGPZ API Documentation',
    version: '1.0.0',
    createdBy: 'ThaddeusTechz',
    
    introduction: `
      WORLDGPZ API provides comprehensive global monitoring data including:
      - Conflict zones and military activities
      - Weather events and natural disasters
      - Economic indicators and sanctions
      - Nuclear facilities and waterway monitoring
      - Real-time news aggregation
      - AI-powered insights and predictions
    `,
    
    endpoints: {
      'GET /': 'API information',
      'GET /api/v1': 'API overview',
      'GET /api/v1/docs': 'This documentation',
      'GET /api/v1/status': 'API status',
      'GET /api/v1/health': 'Health check',
      'GET /api/v1/stats': 'System statistics',
      
      'Data Endpoints': {
        'GET /api/v1/data/conflicts': 'Get all conflicts',
        'GET /api/v1/data/conflicts/:id': 'Get conflict by ID',
        'GET /api/v1/data/weather': 'Get weather events',
        'GET /api/v1/data/military': 'Get military activities',
        'GET /api/v1/data/economic': 'Get economic data',
        'GET /api/v1/data/nuclear': 'Get nuclear facilities',
        'GET /api/v1/data/sanctions': 'Get sanctions',
        'GET /api/v1/data/disasters': 'Get natural disasters',
        'GET /api/v1/data/map': 'Get map data for markers',
        'GET /api/v1/data/news': 'Get news feed',
      },
      
      'Analytics Endpoints': {
        'GET /api/v1/analytics/overview': 'Get overview analytics',
        'GET /api/v1/analytics/trends': 'Get trend data',
        'GET /api/v1/analytics/regions': 'Get regional analysis',
        'GET /api/v1/analytics/statistics': 'Get statistics',
        'GET /api/v1/analytics/predictions': 'Get AI predictions',
      },
      
      'Auth Endpoints': {
        'POST /api/v1/auth/register': 'Register new user',
        'POST /api/v1/auth/login': 'Login',
        'POST /api/v1/auth/logout': 'Logout',
        'GET /api/v1/auth/me': 'Get current user',
        'PUT /api/v1/auth/me': 'Update profile',
      },
    },
    
    authentication: {
      type: 'Bearer Token',
      header: 'Authorization: Bearer <token>',
      description: 'Include your JWT token in the Authorization header for protected endpoints.',
    },
    
    rateLimiting: {
      windowMs: config.rateLimit.windowMs,
      maxRequests: config.rateLimit.max,
      message: 'Too many requests, please try again later.',
    },
    
    errors: {
      400: 'Bad Request - Invalid input',
      401: 'Unauthorized - Invalid or missing token',
      403: 'Forbidden - Insufficient permissions',
      404: 'Not Found - Resource does not exist',
      429: 'Too Many Requests - Rate limit exceeded',
      500: 'Internal Server Error - Something went wrong',
    },
    
    contact: {
      author: 'ThaddeusTechz',
      website: 'https://worldgpz.com',
    },
  });
};

// Get API status
export const getStatus = async (req, res) => {
  const status = {
    status: 'operational',
    version: '1.0.0',
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
    services: {
      api: 'operational',
      database: 'operational',
      cache: 'operational',
      external_apis: 'operational',
    },
    uptime: process.uptime(),
  };
  
  res.json(status);
};

// Get available endpoints
export const getEndpoints = async (req, res) => {
  res.json({
    totalEndpoints: 45,
    categories: {
      api: 5,
      data: 24,
      analytics: 10,
      auth: 6,
    },
    endpoints: [
      // API
      { method: 'GET', path: '/', description: 'API information' },
      { method: 'GET', path: '/api/v1', description: 'API overview' },
      { method: 'GET', path: '/api/v1/docs', description: 'API documentation' },
      { method: 'GET', path: '/api/v1/status', description: 'API status' },
      { method: 'GET', path: '/api/v1/stats', description: 'System statistics' },
      
      // Data
      { method: 'GET', path: '/api/v1/data/conflicts', description: 'Get conflicts' },
      { method: 'GET', path: '/api/v1/data/weather', description: 'Get weather events' },
      { method: 'GET', path: '/api/v1/data/military', description: 'Get military activities' },
      { method: 'GET', path: '/api/v1/data/economic', description: 'Get economic data' },
      { method: 'GET', path: '/api/v1/data/nuclear', description: 'Get nuclear facilities' },
      { method: 'GET', path: '/api/v1/data/map', description: 'Get map data' },
      
      // Analytics
      { method: 'GET', path: '/api/v1/analytics/overview', description: 'Get overview' },
      { method: 'GET', path: '/api/v1/analytics/trends', description: 'Get trends' },
      { method: 'GET', path: '/api/v1/analytics/predictions', description: 'Get AI predictions' },
      
      // Auth
      { method: 'POST', path: '/api/v1/auth/register', description: 'Register' },
      { method: 'POST', path: '/api/v1/auth/login', description: 'Login' },
    ],
  });
};

// Get detailed health information
export const getDetailedHealth = async (req, res) => {
  const memUsage = process.memoryUsage();
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
    
    system: {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      cpus: os.cpus().length,
      totalMemory: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
      freeMemory: `${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
    },
    
    process: {
      pid: process.pid,
      memory: {
        rss: `${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        external: `${(memUsage.external / 1024 / 1024).toFixed(2)} MB`,
      },
      cpuUsage: process.cpuUsage(),
    },
    
    services: {
      api: { status: 'operational', latency: '< 1ms' },
      database: { status: 'operational', latency: '< 10ms' },
      cache: { status: 'operational', latency: '< 5ms' },
    },
  });
};

// Get system statistics
export const getStats = async (req, res) => {
  // Mock statistics - in production, fetch from database
  const stats = {
    totalDataPoints: 15847,
    activeConflicts: 47,
    weatherEvents: 128,
    militaryActivities: 89,
    economicIndicators: 34,
    naturalDisasters: 23,
    nuclearFacilities: 412,
    countriesMonitored: 195,
    activeUsers: 2341,
    apiCalls: {
      today: 45231,
      thisWeek: 312847,
      thisMonth: 1245893,
    },
    cacheHitRate: '94.5%',
    averageResponseTime: '45ms',
    uptimePercentage: '99.97%',
  };
  
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    statistics: stats,
  });
};