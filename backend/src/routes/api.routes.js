import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import * as apiController from '../controllers/api.controller.js';

const router = express.Router();

// API Info endpoint
router.get('/', asyncHandler(apiController.getApiInfo));

// API Documentation
router.get('/docs', asyncHandler(apiController.getDocumentation));

// API Status
router.get('/status', asyncHandler(apiController.getStatus));

// Available endpoints
router.get('/endpoints', asyncHandler(apiController.getEndpoints));

// Health check with detailed status
router.get('/health-detailed', asyncHandler(apiController.getDetailedHealth));

// Get system statistics
router.get('/stats', asyncHandler(apiController.getStats));

export default router;