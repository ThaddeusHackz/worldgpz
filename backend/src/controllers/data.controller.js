import { v4 as uuidv4 } from 'uuid';
import { format, subDays, subHours } from 'date-fns';
import { logger } from '../utils/logger.js';

// Mock data stores - in production, use actual database
const conflictsStore = [
  { id: uuidv4(), title: 'Eastern Europe Conflict', location: { lat: 48.5, lng: 32.5 }, severity: 'critical', status: 'active', casualties: 12500, createdAt: subDays(new Date(), 2), updatedAt: new Date() },
  { id: uuidv4(), title: 'Middle East Tensions', location: { lat: 33.2, lng: 43.7 }, severity: 'high', status: 'active', casualties: 8900, createdAt: subDays(new Date(), 5), updatedAt: new Date() },
  { id: uuidv4(), title: 'South China Sea Disputes', location: { lat: 15.5, lng: 118.5 }, severity: 'medium', status: 'monitoring', casualties: 0, createdAt: subDays(new Date(), 10), updatedAt: new Date() },
  { id: uuidv4(), title: 'Horn of Africa Conflict', location: { lat: 9.1, lng: 42.5 }, severity: 'high', status: 'active', casualties: 4500, createdAt: subDays(new Date(), 3), updatedAt: new Date() },
  { id: uuidv4(), title: 'Balkans Tensions', location: { lat: 42.5, lng: 21.5 }, severity: 'medium', status: 'watch', casualties: 120, createdAt: subDays(new Date(), 15), updatedAt: new Date() },
];

const weatherStore = [
  { id: uuidv4(), title: 'Atlantic Hurricane Season', location: { lat: 25.0, lng: -75.0 }, type: 'hurricane', severity: 'warning', windSpeed: 145, pressure: 950, createdAt: subHours(new Date(), 6), updatedAt: new Date() },
  { id: uuidv4(), title: 'Pacific Typhoon', location: { lat: 15.0, lng: 130.0 }, type: 'typhoon', severity: 'watch', windSpeed: 120, pressure: 960, createdAt: subHours(new Date(), 12), updatedAt: new Date() },
  { id: uuidv4(), title: 'European Storm System', location: { lat: 52.0, lng: 5.0 }, type: 'storm', severity: 'advisory', windSpeed: 85, pressure: 980, createdAt: subHours(new Date(), 3), updatedAt: new Date() },
  { id: uuidv4(), title: 'South Asian Monsoon', location: { lat: 20.0, lng: 80.0 }, type: 'flood', severity: 'alert', windSpeed: 0, pressure: 0, createdAt: subHours(new Date(), 8), updatedAt: new Date() },
  { id: uuidv4(), title: 'Australian Heatwave', location: { lat: -25.0, lng: 135.0 }, type: 'heatwave', severity: 'warning', temperature: 48, createdAt: subDays(new Date(), 1), updatedAt: new Date() },
];

const militaryStore = [
  { id: uuidv4(), title: 'NATO Exercises - Baltic Region', location: { lat: 55.5, lng: 24.0 }, type: 'exercise', units: 5000, status: 'ongoing', countries: ['USA', 'UK', 'Germany', 'Poland'], createdAt: subDays(new Date(), 2), updatedAt: new Date() },
  { id: uuidv4(), title: 'Naval Operations - Pacific', location: { lat: 20.0, lng: 130.0 }, type: 'naval', units: 3400, status: 'ongoing', countries: ['USA', 'Japan', 'Australia'], createdAt: subDays(new Date(), 1), updatedAt: new Date() },
  { id: uuidv4(), title: 'Border Patrol - Middle East', location: { lat: 33.0, lng: 36.0 }, type: 'patrol', units: 1200, status: 'increased', countries: ['Turkey', 'Russia'], createdAt: subHours(new Date(), 18), updatedAt: new Date() },
  { id: uuidv4(), title: 'Air Defense Drills', location: { lat: 40.0, lng: 45.0 }, type: 'air', units: 800, status: 'scheduled', countries: ['Iran'], createdAt: subDays(new Date(), 3), updatedAt: new Date() },
];

const economicStore = [
  { id: uuidv4(), title: 'Global Trade Disruption', type: 'trade', impact: 'high', affectedSectors: ['Shipping', 'Manufacturing'], createdAt: subDays(new Date(), 2), updatedAt: new Date() },
  { id: uuidv4(), title: 'Energy Crisis - Europe', type: 'energy', impact: 'critical', affectedSectors: ['Oil', 'Gas', 'Electricity'], createdAt: subDays(new Date(), 5), updatedAt: new Date() },
  { id: uuidv4(), title: 'Currency Fluctuations', type: 'currency', impact: 'medium', affectedSectors: ['Finance', 'Banking'], createdAt: subDays(new Date(), 1), updatedAt: new Date() },
  { id: uuidv4(), title: 'Supply Chain Issues', type: 'supply', impact: 'high', affectedSectors: ['Manufacturing', 'Agriculture'], createdAt: subDays(new Date(), 7), updatedAt: new Date() },
];

const nuclearStore = [
  { id: uuidv4(), title: 'San Onofre Nuclear Station', location: { lat: 33.37, lng: -117.56 }, type: 'power plant', status: 'decommissioned', capacity: 2200, country: 'USA', createdAt: subDays(new Date(), 100), updatedAt: new Date() },
  { id: uuidv4(), title: 'Fukushima Daiichi', location: { lat: 37.42, lng: 141.03 }, type: 'power plant', status: 'monitoring', capacity: 4690, country: 'Japan', createdAt: subDays(new Date(), 100), updatedAt: new Date() },
  { id: uuidv4(), title: 'Bushehr Nuclear Plant', location: { lat: 28.8, lng: 51.0 }, type: 'power plant', status: 'active', capacity: 1000, country: 'Iran', createdAt: subDays(new Date(), 50), updatedAt: new Date() },
  { id: uuidv4(), title: 'Zaporizhzhia Nuclear', location: { lat: 47.5, lng: 34.6 }, type: 'power plant', status: 'controversial', capacity: 5700, country: 'Ukraine', createdAt: subDays(new Date(), 10), updatedAt: new Date() },
  { id: uuidv4(), title: 'Taishan Nuclear', location: { lat: 21.9, lng: 112.9 }, type: 'power plant', status: 'active', capacity: 3400, country: 'China', createdAt: subDays(new Date(), 30), updatedAt: new Date() },
];

const sanctionsStore = [
  { id: uuidv4(), title: 'Russia Economic Sanctions', target: 'Russia', type: 'economic', issuedBy: 'EU/USA', date: subDays(new Date(), 365), status: 'active', createdAt: subDays(new Date(), 365), updatedAt: new Date() },
  { id: uuidv4(), title: 'Iran Nuclear Sanctions', target: 'Iran', type: 'nuclear', issuedBy: 'UN', date: subDays(new Date(), 180), status: 'active', createdAt: subDays(new Date(), 180), updatedAt: new Date() },
  { id: uuidv4(), title: 'North Korea Sanctions', target: 'North Korea', type: 'military', issuedBy: 'UN', date: subDays(new Date(), 730), status: 'active', createdAt: subDays(new Date(), 730), updatedAt: new Date() },
];

const disastersStore = [
  { id: uuidv4(), title: 'Turkey Earthquake', location: { lat: 37.0, lng: 37.0 }, type: 'earthquake', magnitude: 7.8, severity: 'critical', casualties: 50000, createdAt: subDays(new Date(), 90), updatedAt: new Date() },
  { id: uuidv4(), title: 'Hawaii Wildfires', location: { lat: 20.7, lng: -156.1 }, type: 'wildfire', severity: 'high', area: '15000 acres', createdAt: subDays(new Date(), 60), updatedAt: new Date() },
  { id: uuidv4(), title: 'Libya Floods', location: { lat: 32.8, lng: 13.2 }, type: 'flood', severity: 'critical', casualties: 10000, createdAt: subDays(new Date(), 30), updatedAt: new Date() },
];

// Helper function to get query params
const getQueryParams = (req) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const sort = req.query.sort || 'createdAt';
  const order = req.query.order || 'desc';
  const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
  const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
  
  return { page, limit, sort, order, startDate, endDate };
};

// Conflics endpoints
export const getConflicts = async (req, res) => {
  const { page, limit, sort, order, startDate, endDate } = getQueryParams(req);
  
  let filtered = conflictsStore.filter(c => {
    if (startDate && c.createdAt < startDate) return false;
    if (endDate && c.createdAt > endDate) return false;
    return true;
  });
  
  filtered.sort((a, b) => {
    const aVal = a[sort];
    const bVal = b[sort];
    return order === 'desc' ? (bVal > aVal ? 1 : -1) : (aVal > bVal ? 1 : -1);
  });
  
  const total = filtered.length;
  const start = (page - 1) * limit;
  const data = filtered.slice(start, start + limit);
  
  res.json({
    success: true,
    data,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    timestamp: new Date().toISOString(),
  });
};

export const getConflictById = async (req, res) => {
  const conflict = conflictsStore.find(c => c.id === req.params.id);
  if (!conflict) {
    return res.status(404).json({ success: false, error: 'Conflict not found' });
  }
  res.json({ success: true, data: conflict });
};

export const createConflict = async (req, res) => {
  const conflict = {
    id: uuidv4(),
    ...req.body,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  conflictsStore.push(conflict);
  logger.info(`Conflict created: ${conflict.title}`);
  res.status(201).json({ success: true, data: conflict });
};

export const updateConflict = async (req, res) => {
  const index = conflictsStore.findIndex(c => c.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Conflict not found' });
  }
  conflictsStore[index] = { ...conflictsStore[index], ...req.body, updatedAt: new Date() };
  res.json({ success: true, data: conflictsStore[index] });
};

export const deleteConflict = async (req, res) => {
  const index = conflictsStore.findIndex(c => c.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Conflict not found' });
  }
  conflictsStore.splice(index, 1);
  res.json({ success: true, message: 'Conflict deleted' });
};

// Weather endpoints
export const getWeatherEvents = async (req, res) => {
  const { page, limit } = getQueryParams(req);
  const total = weatherStore.length;
  const start = (page - 1) * limit;
  
  res.json({
    success: true,
    data: weatherStore.slice(start, start + limit),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    timestamp: new Date().toISOString(),
  });
};

export const getWeatherById = async (req, res) => {
  const event = weatherStore.find(w => w.id === req.params.id);
  if (!event) {
    return res.status(404).json({ success: false, error: 'Weather event not found' });
  }
  res.json({ success: true, data: event });
};

export const createWeatherEvent = async (req, res) => {
  const event = { id: uuidv4(), ...req.body, createdAt: new Date(), updatedAt: new Date() };
  weatherStore.push(event);
  res.status(201).json({ success: true, data: event });
};

export const updateWeatherEvent = async (req, res) => {
  const index = weatherStore.findIndex(w => w.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Weather event not found' });
  }
  weatherStore[index] = { ...weatherStore[index], ...req.body, updatedAt: new Date() };
  res.json({ success: true, data: weatherStore[index] });
};

export const deleteWeatherEvent = async (req, res) => {
  const index = weatherStore.findIndex(w => w.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Weather event not found' });
  }
  weatherStore.splice(index, 1);
  res.json({ success: true, message: 'Weather event deleted' });
};

// Military endpoints
export const getMilitaryActivities = async (req, res) => {
  const { page, limit } = getQueryParams(req);
  const total = militaryStore.length;
  const start = (page - 1) * limit;
  
  res.json({
    success: true,
    data: militaryStore.slice(start, start + limit),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    timestamp: new Date().toISOString(),
  });
};

export const getMilitaryById = async (req, res) => {
  const activity = militaryStore.find(m => m.id === req.params.id);
  if (!activity) {
    return res.status(404).json({ success: false, error: 'Military activity not found' });
  }
  res.json({ success: true, data: activity });
};

export const createMilitaryActivity = async (req, res) => {
  const activity = { id: uuidv4(), ...req.body, createdAt: new Date(), updatedAt: new Date() };
  militaryStore.push(activity);
  res.status(201).json({ success: true, data: activity });
};

export const updateMilitaryActivity = async (req, res) => {
  const index = militaryStore.findIndex(m => m.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Military activity not found' });
  }
  militaryStore[index] = { ...militaryStore[index], ...req.body, updatedAt: new Date() };
  res.json({ success: true, data: militaryStore[index] });
};

export const deleteMilitaryActivity = async (req, res) => {
  const index = militaryStore.findIndex(m => m.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Military activity not found' });
  }
  militaryStore.splice(index, 1);
  res.json({ success: true, message: 'Military activity deleted' });
};

// Economic endpoints
export const getEconomicData = async (req, res) => {
  const { page, limit } = getQueryParams(req);
  const total = economicStore.length;
  const start = (page - 1) * limit;
  
  res.json({
    success: true,
    data: economicStore.slice(start, start + limit),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    timestamp: new Date().toISOString(),
  });
};

export const getEconomicById = async (req, res) => {
  const data = economicStore.find(e => e.id === req.params.id);
  if (!data) {
    return res.status(404).json({ success: false, error: 'Economic data not found' });
  }
  res.json({ success: true, data });
};

export const createEconomicData = async (req, res) => {
  const data = { id: uuidv4(), ...req.body, createdAt: new Date(), updatedAt: new Date() };
  economicStore.push(data);
  res.status(201).json({ success: true, data });
};

export const updateEconomicData = async (req, res) => {
  const index = economicStore.findIndex(e => e.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Economic data not found' });
  }
  economicStore[index] = { ...economicStore[index], ...req.body, updatedAt: new Date() };
  res.json({ success: true, data: economicStore[index] });
};

export const deleteEconomicData = async (req, res) => {
  const index = economicStore.findIndex(e => e.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Economic data not found' });
  }
  economicStore.splice(index, 1);
  res.json({ success: true, message: 'Economic data deleted' });
};

// Nuclear endpoints
export const getNuclearFacilities = async (req, res) => {
  const { page, limit } = getQueryParams(req);
  const total = nuclearStore.length;
  const start = (page - 1) * limit;
  
  res.json({
    success: true,
    data: nuclearStore.slice(start, start + limit),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    timestamp: new Date().toISOString(),
  });
};

export const getNuclearById = async (req, res) => {
  const facility = nuclearStore.find(n => n.id === req.params.id);
  if (!facility) {
    return res.status(404).json({ success: false, error: 'Nuclear facility not found' });
  }
  res.json({ success: true, data: facility });
};

export const createNuclearFacility = async (req, res) => {
  const facility = { id: uuidv4(), ...req.body, createdAt: new Date(), updatedAt: new Date() };
  nuclearStore.push(facility);
  res.status(201).json({ success: true, data: facility });
};

export const updateNuclearFacility = async (req, res) => {
  const index = nuclearStore.findIndex(n => n.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Nuclear facility not found' });
  }
  nuclearStore[index] = { ...nuclearStore[index], ...req.body, updatedAt: new Date() };
  res.json({ success: true, data: nuclearStore[index] });
};

export const deleteNuclearFacility = async (req, res) => {
  const index = nuclearStore.findIndex(n => n.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Nuclear facility not found' });
  }
  nuclearStore.splice(index, 1);
  res.json({ success: true, message: 'Nuclear facility deleted' });
};

// Sanctions endpoints
export const getSanctions = async (req, res) => {
  const { page, limit } = getQueryParams(req);
  const total = sanctionsStore.length;
  const start = (page - 1) * limit;
  
  res.json({
    success: true,
    data: sanctionsStore.slice(start, start + limit),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    timestamp: new Date().toISOString(),
  });
};

export const getSanctionById = async (req, res) => {
  const sanction = sanctionsStore.find(s => s.id === req.params.id);
  if (!sanction) {
    return res.status(404).json({ success: false, error: 'Sanction not found' });
  }
  res.json({ success: true, data: sanction });
};

export const createSanction = async (req, res) => {
  const sanction = { id: uuidv4(), ...req.body, createdAt: new Date(), updatedAt: new Date() };
  sanctionsStore.push(sanction);
  res.status(201).json({ success: true, data: sanction });
};

export const updateSanction = async (req, res) => {
  const index = sanctionsStore.findIndex(s => s.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Sanction not found' });
  }
  sanctionsStore[index] = { ...sanctionsStore[index], ...req.body, updatedAt: new Date() };
  res.json({ success: true, data: sanctionsStore[index] });
};

export const deleteSanction = async (req, res) => {
  const index = sanctionsStore.findIndex(s => s.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Sanction not found' });
  }
  sanctionsStore.splice(index, 1);
  res.json({ success: true, message: 'Sanction deleted' });
};

// Disasters endpoints
export const getNaturalDisasters = async (req, res) => {
  const { page, limit } = getQueryParams(req);
  const total = disastersStore.length;
  const start = (page - 1) * limit;
  
  res.json({
    success: true,
    data: disastersStore.slice(start, start + limit),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    timestamp: new Date().toISOString(),
  });
};

export const getDisasterById = async (req, res) => {
  const disaster = disastersStore.find(d => d.id === req.params.id);
  if (!disaster) {
    return res.status(404).json({ success: false, error: 'Disaster not found' });
  }
  res.json({ success: true, data: disaster });
};

export const createDisaster = async (req, res) => {
  const disaster = { id: uuidv4(), ...req.body, createdAt: new Date(), updatedAt: new Date() };
  disastersStore.push(disaster);
  res.status(201).json({ success: true, data: disaster });
};

export const updateDisaster = async (req, res) => {
  const index = disastersStore.findIndex(d => d.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Disaster not found' });
  }
  disastersStore[index] = { ...disastersStore[index], ...req.body, updatedAt: new Date() };
  res.json({ success: true, data: disastersStore[index] });
};

export const deleteDisaster = async (req, res) => {
  const index = disastersStore.findIndex(d => d.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Disaster not found' });
  }
  disastersStore.splice(index, 1);
  res.json({ success: true, message: 'Disaster deleted' });
};

// Map data endpoint (aggregates all markers for the frontend)
export const getMapData = async (req, res) => {
  const { lat, lng, radius } = req.query;
  
  // Parse coordinates and radius
  const centerLat = parseFloat(lat) || 0;
  const centerLng = parseFloat(lng) || 0;
  const searchRadius = parseFloat(radius) || 1000; // km
  
  // Filter data by proximity (simple approximation)
  const filterByProximity = (items) => {
    if (!lat && !lng) return items;
    return items.filter(item => {
      if (!item.location) return false;
      const dLat = Math.abs(item.location.lat - centerLat);
      const dLng = Math.abs(item.location.lng - centerLng);
      const distance = Math.sqrt(dLat * dLat + dLng * dLng) * 111; // rough km conversion
      return distance <= searchRadius;
    });
  };
  
  res.json({
    success: true,
    data: {
      conflicts: filterByProximity(conflictsStore),
      military: filterByProximity(militaryStore),
      nuclear: filterByProximity(nuclearStore),
      weather: filterByProximity(weatherStore),
      disasters: filterByProximity(disastersStore),
    },
    timestamp: new Date().toISOString(),
  });
};

// News feed endpoint
export const getNews = async (req, res) => {
  // Mock news data
  const news = [
    { id: uuidv4(), title: 'Global Economic Summit Concludes with New Trade Agreements', source: 'Reuters', category: 'Economic', time: '2 hours ago', url: '#' },
    { id: uuidv4(), title: 'Climate Conference Reaches Historic Agreement on Emissions', source: 'AP News', category: 'Climate', time: '3 hours ago', url: '#' },
    { id: uuidv4(), title: 'UN Security Council Meets on Regional Conflicts', source: 'BBC', category: 'Security', time: '4 hours ago', url: '#' },
    { id: uuidv4(), title: 'Major Tech Company Announces New AI Initiative', source: 'TechCrunch', category: 'Technology', time: '5 hours ago', url: '#' },
    { id: uuidv4(), title: 'Energy Crisis Prompts Emergency Measures in Europe', source: 'DW', category: 'Energy', time: '6 hours ago', url: '#' },
    { id: uuidv4(), title: 'International Aid Arrives in Disaster Zones', source: 'Al Jazeera', category: 'Humanitarian', time: '7 hours ago', url: '#' },
    { id: uuidv4(), title: 'Military Exercises Conclude Successfully', source: 'Defense News', category: 'Military', time: '8 hours ago', url: '#' },
    { id: uuidv4(), title: 'New Sanctions Package Announced', source: 'Financial Times', category: 'Economic', time: '10 hours ago', url: '#' },
  ];
  
  const { page, limit } = getQueryParams(req);
  const total = news.length;
  const start = (page - 1) * limit;
  
  res.json({
    success: true,
    data: news.slice(start, start + limit),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    timestamp: new Date().toISOString(),
  });
};

// Export all data
export const exportData = async (req, res) => {
  res.json({
    success: true,
    data: {
      conflicts: conflictsStore,
      weather: weatherStore,
      military: militaryStore,
      economic: economicStore,
      nuclear: nuclearStore,
      sanctions: sanctionsStore,
      disasters: disastersStore,
    },
    exportedAt: new Date().toISOString(),
    totalRecords: conflictsStore.length + weatherStore.length + militaryStore.length + economicStore.length + nuclearStore.length + sanctionsStore.length + disastersStore.length,
  });
};

// Import data
export const importData = async (req, res) => {
  const { type, data } = req.body;
  
  if (!type || !data || !Array.isArray(data)) {
    return res.status(400).json({ success: false, error: 'Invalid import data' });
  }
  
  let store;
  switch (type) {
    case 'conflicts': store = conflictsStore; break;
    case 'weather': store = weatherStore; break;
    case 'military': store = militaryStore; break;
    case 'economic': store = economicStore; break;
    case 'nuclear': store = nuclearStore; break;
    case 'sanctions': store = sanctionsStore; break;
    case 'disasters': store = disastersStore; break;
    default:
      return res.status(400).json({ success: false, error: 'Invalid data type' });
  }
  
  const imported = data.map(item => ({
    id: uuidv4(),
    ...item,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
  
  store.push(...imported);
  
  res.status(201).json({
    success: true,
    imported: imported.length,
    total: store.length,
  });
};