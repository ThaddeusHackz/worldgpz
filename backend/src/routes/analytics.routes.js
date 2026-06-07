import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import * as analyticsController from '../controllers/analytics.controller.js';

const router = express.Router();

// Overview analytics
router.get('/overview', asyncHandler(analyticsController.getOverview));

// Trends
router.get('/trends', asyncHandler(analyticsController.getTrends));
router.get('/trends/:type', asyncHandler(analyticsController.getTrendsByType));

// Regional analysis
router.get('/regions', asyncHandler(analyticsController.getRegionalAnalysis));
router.get('/regions/:region', asyncHandler(analyticsController.getRegionDetails));

// Statistics
router.get('/statistics', asyncHandler(analyticsController.getStatistics));
router.get('/statistics/:category', asyncHandler(analyticsController.getCategoryStats));

// Time series data
router.get('/timeseries', asyncHandler(analyticsController.getTimeSeries));
router.get('/timeseries/:metric', asyncHandler(analyticsController.getMetricTimeSeries));

// Comparisons
router.get('/compare', asyncHandler(analyticsController.compareRegions));

// Predictions (AI)
router.get('/predictions', asyncHandler(analyticsController.getPredictions));
router.post('/predictions/analyze', asyncHandler(analyticsController.runAnalysis));

// Reports
router.get('/reports', asyncHandler(analyticsController.getReports));
router.post('/reports/generate', asyncHandler(analyticsController.generateReport));

// Export analytics
router.get('/export', asyncHandler(analyticsController.exportAnalytics));

export default router;