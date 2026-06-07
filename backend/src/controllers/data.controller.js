import { v4 as uuidv4 } from 'uuid';
import { format, subDays, subHours, subMinutes } from 'date-fns';
import { logger } from '../utils/logger.js';

// Comprehensive real-time data stores
const conflictsStore = [
  { id: uuidv4(), title: 'Eastern Europe Conflict Zone', location: { lat: 50.0, lng: 34.0 }, severity: 'critical', status: 'active', casualties: 12500, createdAt: new Date(), updatedAt: new Date(), lastUpdate: new Date() },
  { id: uuidv4(), title: 'Middle East Tensions', location: { lat: 33.2, lng: 43.7 }, severity: 'high', status: 'active', casualties: 8900, createdAt: subDays(new Date(), 5), updatedAt: new Date(), lastUpdate: subMinutes(new Date(), 30) },
  { id: uuidv4(), title: 'South China Sea Disputes', location: { lat: 15.5, lng: 118.5 }, severity: 'medium', status: 'monitoring', casualties: 0, createdAt: subDays(new Date(), 10), updatedAt: new Date(), lastUpdate: subHours(new Date(), 2) },
  { id: uuidv4(), title: 'Central Africa Crisis', location: { lat: 12.5, lng: 18.5 }, severity: 'high', status: 'active', casualties: 4500, createdAt: subDays(new Date(), 3), updatedAt: new Date(), lastUpdate: subMinutes(new Date(), 45) },
  { id: uuidv4(), title: 'Balkans Tensions', location: { lat: 42.5, lng: 21.5 }, severity: 'medium', status: 'watch', casualties: 120, createdAt: subDays(new Date(), 15), updatedAt: new Date(), lastUpdate: subHours(new Date(), 4) },
  { id: uuidv4(), title: 'Horn of Africa Conflict', location: { lat: 9.1, lng: 42.5 }, severity: 'high', status: 'active', casualties: 2300, createdAt: subDays(new Date(), 2), updatedAt: new Date(), lastUpdate: subMinutes(new Date(), 15) },
];

const weatherStore = [
  { id: uuidv4(), title: 'Atlantic Hurricane Season', location: { lat: 25.0, lng: -70.0 }, type: 'hurricane', severity: 'warning', windSpeed: 145, pressure: 950, category: 4, createdAt: new Date(), updatedAt: new Date() },
  { id: uuidv4(), title: 'Pacific Typhoon', location: { lat: 15.0, lng: 135.0 }, type: 'typhoon', severity: 'watch', windSpeed: 120, pressure: 960, category: 3, createdAt: subHours(new Date(), 12), updatedAt: new Date() },
  { id: uuidv4(), title: 'European Storm System', location: { lat: 52.0, lng: 5.0 }, type: 'storm', severity: 'advisory', windSpeed: 85, pressure: 980, createdAt: subHours(new Date(), 3), updatedAt: new Date() },
  { id: uuidv4(), title: 'South Asian Monsoon', location: { lat: 20.0, lng: 80.0 }, type: 'flood', severity: 'alert', rainfall: 'Heavy', createdAt: subHours(new Date(), 8), updatedAt: new Date() },
  { id: uuidv4(), title: 'Australian Heatwave', location: { lat: -25.0, lng: 130.0 }, type: 'heatwave', severity: 'warning', temperature: 48, createdAt: subDays(new Date(), 1), updatedAt: new Date() },
  { id: uuidv4(), title: 'Caribbean Storm', location: { lat: 18.0, lng: -75.0 }, type: 'tropical storm', severity: 'warning', windSpeed: 65, pressure: 995, createdAt: subHours(new Date(), 6), updatedAt: new Date() },
];

const militaryStore = [
  { id: uuidv4(), title: 'NATO Exercises - Baltic Region', location: { lat: 55.5, lng: 24.0 }, type: 'exercise', units: 5000, status: 'ongoing', countries: ['USA', 'UK', 'Germany', 'Poland'], createdAt: subDays(new Date(), 2), updatedAt: new Date() },
  { id: uuidv4(), title: 'Naval Operations - Pacific', location: { lat: 20.0, lng: 130.0 }, type: 'naval', units: 3400, status: 'ongoing', countries: ['USA', 'Japan', 'Australia'], createdAt: subDays(new Date(), 1), updatedAt: new Date() },
  { id: uuidv4(), title: 'Border Patrol - Middle East', location: { lat: 33.0, lng: 36.0 }, type: 'patrol', units: 1200, status: 'increased', countries: ['Turkey', 'Russia'], createdAt: subHours(new Date(), 18), updatedAt: new Date() },
  { id: uuidv4(), title: 'Air Defense Drills', location: { lat: 40.0, lng: 45.0 }, type: 'air', units: 800, status: 'scheduled', countries: ['Iran'], createdAt: subDays(new Date(), 3), updatedAt: new Date() },
  { id: uuidv4(), title: 'Submarine Patrol - Atlantic', location: { lat: 45.0, lng: -30.0 }, type: 'naval', units: 450, status: 'ongoing', countries: ['USA', 'NATO'], createdAt: subHours(new Date(), 8), updatedAt: new Date() },
];

const earthquakesStore = [
  { id: uuidv4(), title: 'Japan Earthquake', location: { lat: 35.5, lng: 140.0 }, magnitude: 5.8, depth: 30, status: 'recent', time: '10 min ago', createdAt: new Date() },
  { id: uuidv4(), title: 'Peru Earthquake', location: { lat: -4.0, lng: -79.0 }, magnitude: 6.2, depth: 45, status: 'recent', time: '25 min ago', createdAt: subMinutes(new Date(), 25) },
  { id: uuidv4(), title: 'Turkey Earthquake', location: { lat: 38.0, lng: 38.0 }, magnitude: 4.5, depth: 20, status: 'monitoring', time: '1 hour ago', createdAt: subHours(new Date(), 1) },
  { id: uuidv4(), title: 'Chile Earthquake', location: { lat: -33.0, lng: -71.0 }, magnitude: 5.1, depth: 60, status: 'monitoring', time: '2 hours ago', createdAt: subHours(new Date(), 2) },
  { id: uuidv4(), title: 'Indonesia Earthquake', location: { lat: -2.5, lng: 140.5 }, magnitude: 5.9, depth: 35, status: 'recent', time: '30 min ago', createdAt: subMinutes(new Date(), 30) },
  { id: uuidv4(), title: 'Philippines Earthquake', location: { lat: 13.0, lng: 122.0 }, magnitude: 5.4, depth: 40, status: 'monitoring', time: '45 min ago', createdAt: subMinutes(new Date(), 45) },
];

const liveNewsStore = [
  { id: uuidv4(), title: 'UN Security Council Convenes Emergency Session on Global Tensions', source: 'Reuters', category: 'World', importance: 'high', flag: '🇺🇳', time: 'Just now', url: '#' },
  { id: uuidv4(), title: 'Major Earthquake Strikes Pacific Ring of Fire - Tsunami Warning Issued', source: 'AP News', category: 'Natural', importance: 'critical', flag: '🌍', time: '2 min ago', url: '#' },
  { id: uuidv4(), title: 'NATO Announces Large-Scale Military Exercises in Baltic Region', source: 'BBC', category: 'Military', importance: 'high', flag: '🛡️', time: '5 min ago', url: '#' },
  { id: uuidv4(), title: 'Global Markets Plunge Amidst Growing Economic Uncertainty', source: 'Bloomberg', category: 'Economic', importance: 'medium', flag: '📉', time: '8 min ago', url: '#' },
  { id: uuidv4(), title: 'Historic Climate Agreement Reached at International Summit', source: 'CNN', category: 'Climate', importance: 'medium', flag: '🌱', time: '12 min ago', url: '#' },
  { id: uuidv4(), title: 'New AI System Predicts Conflict Zones with 94% Accuracy', source: 'TechCrunch', category: 'Technology', importance: 'low', flag: '🤖', time: '15 min ago', url: '#' },
  { id: uuidv4(), title: 'Humanitarian Crisis Deepens in Conflict Zone - Aid Needed', source: 'Al Jazeera', category: 'Humanitarian', importance: 'high', flag: '❤️', time: '18 min ago', url: '#' },
  { id: uuidv4(), title: 'Major Cyber Attack Targets Critical Infrastructure Globally', source: 'Wired', category: 'Security', importance: 'critical', flag: '💻', time: '22 min ago', url: '#' },
  { id: uuidv4(), title: 'Energy Prices Surge as Supply Chain Disruptions Continue', source: 'Financial Times', category: 'Energy', importance: 'medium', flag: '⚡', time: '25 min ago', url: '#' },
  { id: uuidv4(), title: 'Space Agency Discovers New Potentially Habitable Exoplanet', source: 'NASA', category: 'Science', importance: 'low', flag: '🚀', time: '30 min ago', url: '#' },
  { id: uuidv4(), title: 'Border Tensions Rise as Military Buildup Continues', source: 'Fox News', category: 'Military', importance: 'high', flag: '🚨', time: '35 min ago', url: '#' },
  { id: uuidv4(), title: 'Dramatic Weather System Threatens Coastal Regions Worldwide', source: 'Weather Channel', category: 'Weather', importance: 'high', flag: '🌀', time: '40 min ago', url: '#' },
  { id: uuidv4(), title: 'International Trade Negotiations Stall Amid Tensions', source: 'WSJ', category: 'Economic', importance: 'medium', flag: '📊', time: '45 min ago', url: '#' },
  { id: uuidv4(), title: 'Nuclear Talks Resume Between Major Powers', source: 'Politico', category: 'Diplomacy', importance: 'medium', flag: '☢️', time: '50 min ago', url: '#' },
  { id: uuidv4(), title: 'Famine Risk Increases in Multiple Regions - UN Report', source: 'UN News', category: 'Humanitarian', importance: 'critical', flag: '🍞', time: '55 min ago', url: '#' },
];

const youtubeVideosStore = [
  { id: uuidv4(), title: 'LIVE: UN Security Council Emergency Meeting', channel: 'UN News', views: '125K', time: '2 hours ago', thumbnail: '📺', live: true, url: '#', category: 'World' },
  { id: uuidv4(), title: 'Breaking: Military Analysis - Global Conflict Update', channel: 'Defense Weekly', views: '89K', time: '4 hours ago', thumbnail: '🎬', live: false, url: '#', category: 'Military' },
  { id: uuidv4(), title: 'LIVE: Weather Center - Hurricane Tracking Coverage', channel: 'Weather Network', views: '234K', time: '1 hour ago', thumbnail: '🌪️', live: true, url: '#', category: 'Weather' },
  { id: uuidv4(), title: 'Expert Analysis: Economic Impact of Global Events', channel: 'Bloomberg Markets', views: '56K', time: '6 hours ago', thumbnail: '📊', live: false, url: '#', category: 'Economic' },
  { id: uuidv4(), title: 'LIVE: Space Agency Press Conference', channel: 'NASA', views: '456K', time: '30 min ago', thumbnail: '🚀', live: true, url: '#', category: 'Science' },
  { id: uuidv4(), title: 'World Conflict Analysis: Latest Developments', channel: 'Geo Politics', views: '178K', time: '3 hours ago', thumbnail: '🗺️', live: false, url: '#', category: 'World' },
  { id: uuidv4(), title: 'LIVE: Earthquake Response Coverage', channel: 'Disaster News', views: '92K', time: '45 min ago', thumbnail: '🏔️', live: true, url: '#', category: 'Natural' },
];

// Countries data
const countriesStore = [
  { name: 'United States', code: 'US', flag: '🇺🇸', region: 'Americas', conflicts: 3, stability: 85, gdp: 25.46, population: 331 },
  { name: 'Russia', code: 'RU', flag: '🇷🇺', region: 'Europe', conflicts: 5, stability: 35, gdp: 1.77, population: 144 },
  { name: 'China', code: 'CN', flag: '🇨🇳', region: 'Asia', conflicts: 2, stability: 72, gdp: 17.73, population: 1411 },
  { name: 'United Kingdom', code: 'GB', flag: '🇬🇧', region: 'Europe', conflicts: 1, stability: 78, gdp: 3.12, population: 67 },
  { name: 'France', code: 'FR', flag: '🇫🇷', region: 'Europe', conflicts: 2, stability: 75, gdp: 2.94, population: 67 },
  { name: 'Germany', code: 'DE', flag: '🇩🇪', region: 'Europe', conflicts: 1, stability: 82, gdp: 4.26, population: 83 },
  { name: 'Japan', code: 'JP', flag: '🇯🇵', region: 'Asia', conflicts: 1, stability: 88, gdp: 4.94, population: 125 },
  { name: 'India', code: 'IN', flag: '🇮🇳', region: 'Asia', conflicts: 4, stability: 58, gdp: 3.18, population: 1380 },
  { name: 'Brazil', code: 'BR', flag: '🇧🇷', region: 'Americas', conflicts: 2, stability: 65, gdp: 1.92, population: 212 },
  { name: 'Australia', code: 'AU', flag: '🇦🇺', region: 'Oceania', conflicts: 1, stability: 90, gdp: 1.63, population: 25 },
  { name: 'Ukraine', code: 'UA', flag: '🇺🇦', region: 'Europe', conflicts: 8, stability: 25, gdp: 0.16, population: 41 },
  { name: 'Iran', code: 'IR', flag: '🇮🇷', region: 'Middle East', conflicts: 4, stability: 38, gdp: 0.47, population: 84 },
  { name: 'Israel', code: 'IL', flag: '🇮🇱', region: 'Middle East', conflicts: 6, stability: 42, gdp: 0.53, population: 9 },
  { name: 'Saudi Arabia', code: 'SA', flag: '🇸🇦', region: 'Middle East', conflicts: 2, stability: 55, gdp: 0.87, population: 35 },
  { name: 'South Korea', code: 'KR', flag: '🇰🇷', region: 'Asia', conflicts: 2, stability: 80, gdp: 1.65, population: 51 },
];

const economicStore = [
  { id: uuidv4(), title: 'Global Trade Disruption', type: 'trade', impact: 'high', affectedSectors: ['Shipping', 'Manufacturing'], createdAt: new Date(), updatedAt: new Date() },
  { id: uuidv4(), title: 'Energy Crisis - Europe', type: 'energy', impact: 'critical', affectedSectors: ['Oil', 'Gas', 'Electricity'], createdAt: subDays(new Date(), 5), updatedAt: new Date() },
  { id: uuidv4(), title: 'Currency Fluctuations', type: 'currency', impact: 'medium', affectedSectors: ['Finance', 'Banking'], createdAt: subDays(new Date(), 1), updatedAt: new Date() },
  { id: uuidv4(), title: 'Supply Chain Issues', type: 'supply', impact: 'high', affectedSectors: ['Manufacturing', 'Agriculture'], createdAt: subDays(new Date(), 7), updatedAt: new Date() },
  { id: uuidv4(), title: 'Inflation Surge', type: 'inflation', impact: 'high', affectedSectors: ['All Sectors'], createdAt: subDays(new Date(), 3), updatedAt: new Date() },
];

const nuclearStore = [
  { id: uuidv4(), title: 'Fukushima Daiichi', location: { lat: 37.42, lng: 141.03 }, type: 'Nuclear Plant', status: 'Monitoring', capacity: 4690, country: 'Japan', createdAt: subDays(new Date(), 100) },
  { id: uuidv4(), title: 'Bushehr Nuclear', location: { lat: 28.8, lng: 51.0 }, type: 'Nuclear Plant', status: 'Active', capacity: 1000, country: 'Iran', createdAt: subDays(new Date(), 50) },
  { id: uuidv4(), title: 'Zaporizhzhia Nuclear', location: { lat: 47.5, lng: 34.6 }, type: 'Nuclear Plant', status: 'Controversial', capacity: 5700, country: 'Ukraine', createdAt: subDays(new Date(), 10) },
  { id: uuidv4(), title: 'Taishan Nuclear', location: { lat: 21.9, lng: 112.9 }, type: 'Nuclear Plant', status: 'Active', capacity: 3400, country: 'China', createdAt: subDays(new Date(), 30) },
  { id: uuidv4(), title: 'Paluel Nuclear', location: { lat: 49.86, lng: 0.64 }, type: 'Nuclear Plant', status: 'Active', capacity: 5200, country: 'France', createdAt: subDays(new Date(), 60) },
];

// Helper function
const getQueryParams = (req) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const sort = req.query.sort || 'createdAt';
  const order = req.query.order || 'desc';
  return { page, limit, sort, order };
};

// ================== CONFLICTS ==================
export const getConflicts = async (req, res) => {
  const { page, limit } = getQueryParams(req);
  const total = conflictsStore.length;
  const start = (page - 1) * limit;
  
  res.json({
    success: true,
    data: conflictsStore.slice(start, start + limit),
    count: total,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    timestamp: new Date().toISOString(),
  });
};

export const getConflictById = async (req, res) => {
  const conflict = conflictsStore.find(c => c.id === req.params.id);
  if (!conflict) return res.status(404).json({ success: false, error: 'Conflict not found' });
  res.json({ success: true, data: conflict });
};

export const createConflict = async (req, res) => {
  const conflict = { id: uuidv4(), ...req.body, createdAt: new Date(), updatedAt: new Date(), lastUpdate: new Date() };
  conflictsStore.push(conflict);
  res.status(201).json({ success: true, data: conflict });
};

export const updateConflict = async (req, res) => {
  const index = conflictsStore.findIndex(c => c.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, error: 'Conflict not found' });
  conflictsStore[index] = { ...conflictsStore[index], ...req.body, updatedAt: new Date() };
  res.json({ success: true, data: conflictsStore[index] });
};

export const deleteConflict = async (req, res) => {
  const index = conflictsStore.findIndex(c => c.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, error: 'Conflict not found' });
  conflictsStore.splice(index, 1);
  res.json({ success: true, message: 'Conflict deleted' });
};

// ================== WEATHER ==================
export const getWeatherEvents = async (req, res) => {
  const { page, limit } = getQueryParams(req);
  const total = weatherStore.length;
  const start = (page - 1) * limit;
  
  res.json({
    success: true,
    data: weatherStore.slice(start, start + limit),
    count: total,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    timestamp: new Date().toISOString(),
  });
};

export const getWeatherById = async (req, res) => {
  const event = weatherStore.find(w => w.id === req.params.id);
  if (!event) return res.status(404).json({ success: false, error: 'Weather event not found' });
  res.json({ success: true, data: event });
};

export const createWeatherEvent = async (req, res) => {
  const event = { id: uuidv4(), ...req.body, createdAt: new Date(), updatedAt: new Date() };
  weatherStore.push(event);
  res.status(201).json({ success: true, data: event });
};

export const updateWeatherEvent = async (req, res) => {
  const index = weatherStore.findIndex(w => w.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, error: 'Weather event not found' });
  weatherStore[index] = { ...weatherStore[index], ...req.body, updatedAt: new Date() };
  res.json({ success: true, data: weatherStore[index] });
};

export const deleteWeatherEvent = async (req, res) => {
  const index = weatherStore.findIndex(w => w.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, error: 'Weather event not found' });
  weatherStore.splice(index, 1);
  res.json({ success: true, message: 'Weather event deleted' });
};

// ================== MILITARY ==================
export const getMilitaryActivities = async (req, res) => {
  const { page, limit } = getQueryParams(req);
  const total = militaryStore.length;
  const start = (page - 1) * limit;
  
  res.json({
    success: true,
    data: militaryStore.slice(start, start + limit),
    count: total,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    timestamp: new Date().toISOString(),
  });
};

export const getMilitaryById = async (req, res) => {
  const activity = militaryStore.find(m => m.id === req.params.id);
  if (!activity) return res.status(404).json({ success: false, error: 'Military activity not found' });
  res.json({ success: true, data: activity });
};

export const createMilitaryActivity = async (req, res) => {
  const activity = { id: uuidv4(), ...req.body, createdAt: new Date(), updatedAt: new Date() };
  militaryStore.push(activity);
  res.status(201).json({ success: true, data: activity });
};

export const updateMilitaryActivity = async (req, res) => {
  const index = militaryStore.findIndex(m => m.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, error: 'Military activity not found' });
  militaryStore[index] = { ...militaryStore[index], ...req.body, updatedAt: new Date() };
  res.json({ success: true, data: militaryStore[index] });
};

export const deleteMilitaryActivity = async (req, res) => {
  const index = militaryStore.findIndex(m => m.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, error: 'Military activity not found' });
  militaryStore.splice(index, 1);
  res.json({ success: true, message: 'Military activity deleted' });
};

// ================== EARTHQUAKES ==================
export const getEarthquakes = async (req, res) => {
  const { page, limit } = getQueryParams(req);
  const total = earthquakesStore.length;
  const start = (page - 1) * limit;
  
  res.json({
    success: true,
    data: earthquakesStore.slice(start, start + limit),
    count: total,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    timestamp: new Date().toISOString(),
  });
};

export const getEarthquakeById = async (req, res) => {
  const quake = earthquakesStore.find(q => q.id === req.params.id);
  if (!quake) return res.status(404).json({ success: false, error: 'Earthquake not found' });
  res.json({ success: true, data: quake });
};

export const createEarthquake = async (req, res) => {
  const quake = { id: uuidv4(), ...req.body, createdAt: new Date() };
  earthquakesStore.push(quake);
  res.status(201).json({ success: true, data: quake });
};

export const updateEarthquake = async (req, res) => {
  const index = earthquakesStore.findIndex(q => q.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, error: 'Earthquake not found' });
  earthquakesStore[index] = { ...earthquakesStore[index], ...req.body };
  res.json({ success: true, data: earthquakesStore[index] });
};

export const deleteEarthquake = async (req, res) => {
  const index = earthquakesStore.findIndex(q => q.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, error: 'Earthquake not found' });
  earthquakesStore.splice(index, 1);
  res.json({ success: true, message: 'Earthquake deleted' });
};

// Aliases for existing endpoints
export const getNaturalDisasters = getEarthquakes;
export const getDisasterById = getEarthquakeById;
export const createDisaster = createEarthquake;
export const updateDisaster = updateEarthquake;
export const deleteDisaster = deleteEarthquake;

// ================== NEWS ==================
export const getNews = async (req, res) => {
  const { page, limit } = getQueryParams(req);
  const category = req.query.category;
  
  let filteredNews = category 
    ? liveNewsStore.filter(n => n.category.toLowerCase() === category.toLowerCase())
    : liveNewsStore;
  
  const total = filteredNews.length;
  const start = (page - 1) * limit;
  
  res.json({
    success: true,
    data: filteredNews.slice(start, start + limit),
    count: total,
    categories: [...new Set(liveNewsStore.map(n => n.category))],
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    timestamp: new Date().toISOString(),
  });
};

// ================== YOUTUBE ==================
export const getYoutubeVideos = async (req, res) => {
  const { page, limit } = getQueryParams(req);
  const live = req.query.live;
  const category = req.query.category;
  
  let filtered = youtubeVideosStore;
  if (live !== undefined) filtered = filtered.filter(v => v.live === (live === 'true'));
  if (category) filtered = filtered.filter(v => v.category.toLowerCase() === category.toLowerCase());
  
  const total = filtered.length;
  const start = (page - 1) * limit;
  
  res.json({
    success: true,
    data: filtered.slice(start, start + limit),
    count: total,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    timestamp: new Date().toISOString(),
  });
};

// ================== COUNTRIES ==================
export const getCountries = async (req, res) => {
  const region = req.query.region;
  const sort = req.query.sort || 'conflicts';
  const order = req.query.order || 'desc';
  
  let filtered = region 
    ? countriesStore.filter(c => c.region.toLowerCase() === region.toLowerCase())
    : countriesStore;
  
  // Sort
  filtered.sort((a, b) => {
    const aVal = a[sort] || 0;
    const bVal = b[sort] || 0;
    return order === 'desc' ? bVal - aVal : aVal - bVal;
  });
  
  res.json({
    success: true,
    data: filtered,
    count: filtered.length,
    regions: [...new Set(countriesStore.map(c => c.region))],
    timestamp: new Date().toISOString(),
  });
};

export const getCountryByCode = async (req, res) => {
  const country = countriesStore.find(c => c.code.toLowerCase() === req.params.code.toLowerCase());
  if (!country) return res.status(404).json({ success: false, error: 'Country not found' });
  res.json({ success: true, data: country });
};

// ================== ECONOMIC ==================
export const getEconomicData = async (req, res) => {
  const { page, limit } = getQueryParams(req);
  const total = economicStore.length;
  const start = (page - 1) * limit;
  
  res.json({
    success: true,
    data: economicStore.slice(start, start + limit),
    count: total,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    timestamp: new Date().toISOString(),
  });
};

export const getEconomicById = async (req, res) => {
  const data = economicStore.find(e => e.id === req.params.id);
  if (!data) return res.status(404).json({ success: false, error: 'Economic data not found' });
  res.json({ success: true, data });
};

export const createEconomicData = async (req, res) => {
  const data = { id: uuidv4(), ...req.body, createdAt: new Date(), updatedAt: new Date() };
  economicStore.push(data);
  res.status(201).json({ success: true, data });
};

export const updateEconomicData = async (req, res) => {
  const index = economicStore.findIndex(e => e.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, error: 'Economic data not found' });
  economicStore[index] = { ...economicStore[index], ...req.body, updatedAt: new Date() };
  res.json({ success: true, data: economicStore[index] });
};

export const deleteEconomicData = async (req, res) => {
  const index = economicStore.findIndex(e => e.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, error: 'Economic data not found' });
  economicStore.splice(index, 1);
  res.json({ success: true, message: 'Economic data deleted' });
};

// ================== NUCLEAR ==================
export const getNuclearFacilities = async (req, res) => {
  const { page, limit } = getQueryParams(req);
  const total = nuclearStore.length;
  const start = (page - 1) * limit;
  
  res.json({
    success: true,
    data: nuclearStore.slice(start, start + limit),
    count: total,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    timestamp: new Date().toISOString(),
  });
};

export const getNuclearById = async (req, res) => {
  const facility = nuclearStore.find(n => n.id === req.params.id);
  if (!facility) return res.status(404).json({ success: false, error: 'Nuclear facility not found' });
  res.json({ success: true, data: facility });
};

export const createNuclearFacility = async (req, res) => {
  const facility = { id: uuidv4(), ...req.body, createdAt: new Date(), updatedAt: new Date() };
  nuclearStore.push(facility);
  res.status(201).json({ success: true, data: facility });
};

export const updateNuclearFacility = async (req, res) => {
  const index = nuclearStore.findIndex(n => n.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, error: 'Nuclear facility not found' });
  nuclearStore[index] = { ...nuclearStore[index], ...req.body, updatedAt: new Date() };
  res.json({ success: true, data: nuclearStore[index] });
};

export const deleteNuclearFacility = async (req, res) => {
  const index = nuclearStore.findIndex(n => n.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, error: 'Nuclear facility not found' });
  nuclearStore.splice(index, 1);
  res.json({ success: true, message: 'Nuclear facility deleted' });
};

// Aliases
export const getSanctions = getConflicts;
export const getSanctionById = getConflictById;
export const createSanction = createConflict;
export const updateSanction = updateConflict;
export const deleteSanction = deleteConflict;

// ================== MAP DATA ==================
export const getMapData = async (req, res) => {
  const { lat, lng, radius, layers } = req.query;
  
  const centerLat = parseFloat(lat) || 0;
  const centerLng = parseFloat(lng) || 0;
  const searchRadius = parseFloat(radius) || 1000;
  
  const filterByProximity = (items) => {
    if (!lat && !lng) return items;
    return items.filter(item => {
      if (!item.location) return false;
      const dLat = Math.abs(item.location.lat - centerLat);
      const dLng = Math.abs(item.location.lng - centerLng);
      const distance = Math.sqrt(dLat * dLat + dLng * dLng) * 111;
      return distance <= searchRadius;
    });
  };

  const requestedLayers = layers ? layers.split(',') : ['conflicts', 'weather', 'military', 'nuclear', 'earthquakes'];
  
  const mapData = {};
  if (requestedLayers.includes('conflicts')) mapData.conflicts = filterByProximity(conflictsStore);
  if (requestedLayers.includes('weather')) mapData.weather = filterByProximity(weatherStore);
  if (requestedLayers.includes('military')) mapData.military = filterByProximity(militaryStore);
  if (requestedLayers.includes('nuclear')) mapData.nuclear = filterByProximity(nuclearStore);
  if (requestedLayers.includes('earthquakes')) mapData.earthquakes = filterByProximity(earthquakesStore);
  
  res.json({
    success: true,
    data: mapData,
    count: Object.values(mapData).reduce((sum, arr) => sum + arr.length, 0),
    timestamp: new Date().toISOString(),
  });
};

// ================== EXPORT ==================
export const exportData = async (req, res) => {
  res.json({
    success: true,
    data: {
      conflicts: conflictsStore,
      weather: weatherStore,
      military: militaryStore,
      earthquakes: earthquakesStore,
      news: liveNewsStore,
      youtube: youtubeVideosStore,
      countries: countriesStore,
      economic: economicStore,
      nuclear: nuclearStore,
    },
    exportedAt: new Date().toISOString(),
    totalRecords: conflictsStore.length + weatherStore.length + militaryStore.length + earthquakesStore.length + liveNewsStore.length + youtubeVideosStore.length + countriesStore.length + economicStore.length + nuclearStore.length,
  });
};

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
    case 'earthquakes': store = earthquakesStore; break;
    case 'news': store = liveNewsStore; break;
    case 'youtube': store = youtubeVideosStore; break;
    case 'countries': store = countriesStore; break;
    case 'economic': store = economicStore; break;
    case 'nuclear': store = nuclearStore; break;
    default: return res.status(400).json({ success: false, error: 'Invalid data type' });
  }
  
  const imported = data.map(item => ({ id: uuidv4(), ...item, createdAt: new Date(), updatedAt: new Date() }));
  store.push(...imported);
  
  res.status(201).json({ success: true, imported: imported.length, total: store.length });
};

// ================== LIVE UPDATES ==================
export const getLiveUpdates = async (req, res) => {
  // Simulate real-time updates
  const updates = [
    { type: 'conflict', message: 'Conflict escalation detected in Eastern Europe', time: '2 min ago', severity: 'high' },
    { type: 'weather', message: 'New hurricane formed in Atlantic', time: '5 min ago', severity: 'medium' },
    { type: 'military', message: 'NATO exercises expanded', time: '8 min ago', severity: 'medium' },
    { type: 'earthquake', message: '5.2 magnitude earthquake in Japan', time: '12 min ago', severity: 'high' },
    { type: 'economic', message: 'Global markets showing volatility', time: '15 min ago', severity: 'medium' },
  ];
  
  res.json({
    success: true,
    data: updates,
    timestamp: new Date().toISOString(),
    updateInterval: 30000, // 30 seconds
  });
};