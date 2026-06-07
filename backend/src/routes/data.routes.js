import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import * as dataController from '../controllers/data.controller.js';
import { validateQuery } from '../middleware/validator.js';

const router = express.Router();

// Conflicts
router.get('/conflicts', asyncHandler(dataController.getConflicts));
router.get('/conflicts/:id', asyncHandler(dataController.getConflictById));
router.post('/conflicts', asyncHandler(dataController.createConflict));
router.put('/conflicts/:id', asyncHandler(dataController.updateConflict));
router.delete('/conflicts/:id', asyncHandler(dataController.deleteConflict));

// Weather
router.get('/weather', asyncHandler(dataController.getWeatherEvents));
router.get('/weather/:id', asyncHandler(dataController.getWeatherById));
router.post('/weather', asyncHandler(dataController.createWeatherEvent));
router.put('/weather/:id', asyncHandler(dataController.updateWeatherEvent));
router.delete('/weather/:id', asyncHandler(dataController.deleteWeatherEvent));

// Military
router.get('/military', asyncHandler(dataController.getMilitaryActivities));
router.get('/military/:id', asyncHandler(dataController.getMilitaryById));
router.post('/military', asyncHandler(dataController.createMilitaryActivity));
router.put('/military/:id', asyncHandler(dataController.updateMilitaryActivity));
router.delete('/military/:id', asyncHandler(dataController.deleteMilitaryActivity));

// Economic
router.get('/economic', asyncHandler(dataController.getEconomicData));
router.get('/economic/:id', asyncHandler(dataController.getEconomicById));
router.post('/economic', asyncHandler(dataController.createEconomicData));
router.put('/economic/:id', asyncHandler(dataController.updateEconomicData));
router.delete('/economic/:id', asyncHandler(dataController.deleteEconomicData));

// Nuclear
router.get('/nuclear', asyncHandler(dataController.getNuclearFacilities));
router.get('/nuclear/:id', asyncHandler(dataController.getNuclearById));
router.post('/nuclear', asyncHandler(dataController.createNuclearFacility));
router.put('/nuclear/:id', asyncHandler(dataController.updateNuclearFacility));
router.delete('/nuclear/:id', asyncHandler(dataController.deleteNuclearFacility));

// Sanctions
router.get('/sanctions', asyncHandler(dataController.getSanctions));
router.get('/sanctions/:id', asyncHandler(dataController.getSanctionById));
router.post('/sanctions', asyncHandler(dataController.createSanction));
router.put('/sanctions/:id', asyncHandler(dataController.updateSanction));
router.delete('/sanctions/:id', asyncHandler(dataController.deleteSanction));

// Natural Disasters
router.get('/disasters', asyncHandler(dataController.getNaturalDisasters));
router.get('/disasters/:id', asyncHandler(dataController.getDisasterById));
router.post('/disasters', asyncHandler(dataController.createDisaster));
router.put('/disasters/:id', asyncHandler(dataController.updateDisaster));
router.delete('/disasters/:id', asyncHandler(dataController.deleteDisaster));

// Map Data (for frontend map markers)
router.get('/map', asyncHandler(dataController.getMapData));

// News Feed
router.get('/news', asyncHandler(dataController.getNews));

// Export all data
router.get('/export', asyncHandler(dataController.exportData));

// Bulk import
router.post('/import', asyncHandler(dataController.importData));

export default router;