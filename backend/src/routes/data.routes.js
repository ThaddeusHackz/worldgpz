import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import * as dataController from '../controllers/data.controller.js';

const router = express.Router();

// ============ CONFLICTS ============
router.get('/conflicts', asyncHandler(dataController.getConflicts));
router.get('/conflicts/:id', asyncHandler(dataController.getConflictById));
router.post('/conflicts', asyncHandler(dataController.createConflict));
router.put('/conflicts/:id', asyncHandler(dataController.updateConflict));
router.delete('/conflicts/:id', asyncHandler(dataController.deleteConflict));

// ============ WEATHER ============
router.get('/weather', asyncHandler(dataController.getWeatherEvents));
router.get('/weather/:id', asyncHandler(dataController.getWeatherById));
router.post('/weather', asyncHandler(dataController.createWeatherEvent));
router.put('/weather/:id', asyncHandler(dataController.updateWeatherEvent));
router.delete('/weather/:id', asyncHandler(dataController.deleteWeatherEvent));

// ============ MILITARY ============
router.get('/military', asyncHandler(dataController.getMilitaryActivities));
router.get('/military/:id', asyncHandler(dataController.getMilitaryById));
router.post('/military', asyncHandler(dataController.createMilitaryActivity));
router.put('/military/:id', asyncHandler(dataController.updateMilitaryActivity));
router.delete('/military/:id', asyncHandler(dataController.deleteMilitaryActivity));

// ============ EARTHQUAKES ============
router.get('/earthquakes', asyncHandler(dataController.getEarthquakes));
router.get('/earthquakes/:id', asyncHandler(dataController.getEarthquakeById));
router.post('/earthquakes', asyncHandler(dataController.createEarthquake));
router.put('/earthquakes/:id', asyncHandler(dataController.updateEarthquake));
router.delete('/earthquakes/:id', asyncHandler(dataController.deleteEarthquake));

// Alias for natural disasters (same as earthquakes)
router.get('/disasters', asyncHandler(dataController.getNaturalDisasters));
router.get('/disasters/:id', asyncHandler(dataController.getDisasterById));
router.post('/disasters', asyncHandler(dataController.createDisaster));
router.put('/disasters/:id', asyncHandler(dataController.updateDisaster));
router.delete('/disasters/:id', asyncHandler(dataController.deleteDisaster));

// ============ NEWS ============
router.get('/news', asyncHandler(dataController.getNews));

// ============ YOUTUBE ============
router.get('/youtube', asyncHandler(dataController.getYoutubeVideos));

// ============ COUNTRIES ============
router.get('/countries', asyncHandler(dataController.getCountries));
router.get('/countries/:code', asyncHandler(dataController.getCountryByCode));

// ============ ECONOMIC ============
router.get('/economic', asyncHandler(dataController.getEconomicData));
router.get('/economic/:id', asyncHandler(dataController.getEconomicById));
router.post('/economic', asyncHandler(dataController.createEconomicData));
router.put('/economic/:id', asyncHandler(dataController.updateEconomicData));
router.delete('/economic/:id', asyncHandler(dataController.deleteEconomicData));

// ============ NUCLEAR ============
router.get('/nuclear', asyncHandler(dataController.getNuclearFacilities));
router.get('/nuclear/:id', asyncHandler(dataController.getNuclearById));
router.post('/nuclear', asyncHandler(dataController.createNuclearFacility));
router.put('/nuclear/:id', asyncHandler(dataController.updateNuclearFacility));
router.delete('/nuclear/:id', asyncHandler(dataController.deleteNuclearFacility));

// ============ SANCTIONS (alias for conflicts) ============
router.get('/sanctions', asyncHandler(dataController.getSanctions));
router.get('/sanctions/:id', asyncHandler(dataController.getSanctionById));
router.post('/sanctions', asyncHandler(dataController.createSanction));
router.put('/sanctions/:id', asyncHandler(dataController.updateSanction));
router.delete('/sanctions/:id', asyncHandler(dataController.deleteSanction));

// ============ MAP DATA ============
router.get('/map', asyncHandler(dataController.getMapData));

// ============ LIVE UPDATES ============
router.get('/live-updates', asyncHandler(dataController.getLiveUpdates));

// ============ EXPORT/IMPORT ============
router.get('/export', asyncHandler(dataController.exportData));
router.post('/import', asyncHandler(dataController.importData));

export default router;