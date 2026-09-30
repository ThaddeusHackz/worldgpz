import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest, listFrom } from './api.js';
import { useDirectUplink } from './useDirectUplink.js';

const FIVE_MINUTES = 5 * 60_000;
const DATA_SOURCES = [
  { key: 'events', url: '/api/events', interval: FIVE_MINUTES, transform: (data) => listFrom(data, 'events') },
  { key: 'weather', url: '/api/weather', interval: 10 * 60_000, transform: (data) => listFrom(data) },
  { key: 'flights', url: '/api/flights', interval: 30_000, transform: (data) => listFrom(data) },
  { key: 'ships', url: '/api/ships', interval: 30_000, transform: (data) => listFrom(data) },
  { key: 'news', url: '/api/news', interval: 15 * 60_000, transform: (data) => listFrom(data, 'articles') },
  { key: 'markets', url: '/api/markets', interval: 60_000, transform: (data) => listFrom(data) },
  { key: 'conflicts', url: '/api/events/conflicts', interval: 60 * 60_000, transform: (data) => listFrom(data) },
  { key: 'fires', url: '/api/events/fires', interval: 6 * 60 * 60_000, transform: (data) => listFrom(data) },
  { key: 'iss', url: '/api/iss', interval: 5_000, transform: (data) => data },
  { key: 'briefing', url: '/api/intel/briefing', interval: 30 * 60_000, transform: (data) => data },
  { key: 'health', url: '/api/providers/health', interval: 2 * 60_000, transform: (data) => listFrom(data, 'providers') },
  { key: 'energy', url: '/api/energy', interval: 60 * 60_000, transform: (data) => listFrom(data) },
  { key: 'economics', url: '/api/economics', interval: 60 * 60_000, transform: (data) => listFrom(data) },
  { key: 'webcams', url: '/api/media/webcams', interval: 3 * 60 * 60_000, transform: (data) => listFrom(data, 'webcams') },
  { key: 'countries', url: '/api/situational/countries', interval: FIVE_MINUTES, transform: (data) => listFrom(data) },
  { key: 'chokepoints', url: '/api/situational/chokepoints', interval: FIVE_MINUTES, transform: (data) => listFrom(data) },
];

const INITIAL_STATE = {
  events: [], weather: [], flights: [], ships: [], news: [], markets: [], conflicts: [], fires: [], iss: null,
  briefing: null, health: [], energy: [], economics: [], webcams: [], countries: [], chokepoints: [], errors: {}, lastSync: null,
};

export function useDashboardData(streamEnabled = true) {
  const [data, setData] = useState(INITIAL_STATE);
  const [refreshing, setRefreshing] = useState(false);
  const loadRef = useRef(null);

  const loadOne = useCallback(async (source) => {
    try {
      const response = await apiRequest(source.url);
      const value = source.transform(response);
      setData((previous) => ({ ...previous, [source.key]: value, lastSync: Date.now(), errors: { ...previous.errors, [source.key]: null } }));
      return value;
    } catch (error) {
      setData((previous) => ({ ...previous, errors: { ...previous.errors, [source.key]: error.message } }));
      return null;
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled(DATA_SOURCES.map((source) => loadOne(source)));
    setRefreshing(false);
  }, [loadOne]);
  loadRef.current = { loadOne, refreshAll };

  useEffect(() => {
    void refreshAll();
    const timers = DATA_SOURCES.filter((source) => source.interval).map((source) => setInterval(() => loadRef.current?.loadOne(source), source.interval));
    return () => timers.forEach(clearInterval);
  }, [refreshAll]);

  const handleStreamEvent = useCallback((type, payload) => {
    const array = (value) => Array.isArray(value) ? value : value ? [value] : [];
    const updateCollection = (key, incoming, eventType) => setData((previous) => {
      const rest = previous.events.filter((item) => item.type !== eventType);
      return { ...previous, [key]: incoming, events: [...rest, ...array(incoming).map((item) => ({ ...item, type: item.type || eventType }))], lastSync: Date.now() };
    });
    if (type === 'health' && Array.isArray(payload)) setData((previous) => ({ ...previous, health: payload, lastSync: Date.now() }));
    else if (type === 'seismic') updateCollection('events', payload, 'seismic');
    else if (type === 'natural') updateCollection('events', payload, 'natural');
    else if (type === 'conflict') updateCollection('conflicts', array(payload), 'conflict');
    else if (type === 'fire') updateCollection('fires', array(payload), 'fire');
    else if (type === 'weather') setData((previous) => ({ ...previous, weather: array(payload), lastSync: Date.now() }));
    else if (type === 'flight') setData((previous) => ({ ...previous, flights: array(payload), lastSync: Date.now() }));
    else if (type === 'ship') setData((previous) => ({ ...previous, ships: array(payload), lastSync: Date.now() }));
    else if (type === 'news') setData((previous) => ({ ...previous, news: array(payload), lastSync: Date.now() }));
    else if (type === 'market') setData((previous) => ({ ...previous, markets: array(payload), lastSync: Date.now() }));
    else if (type === 'briefing') setData((previous) => ({ ...previous, briefing: payload, lastSync: Date.now() }));
    else if (type === 'iss') setData((previous) => ({ ...previous, iss: payload, lastSync: Date.now() }));
    else if (type === 'connected' || type === 'heartbeat') setData((previous) => ({ ...previous, lastSync: Date.now() }));
  }, []);

  const uplink = useDirectUplink(handleStreamEvent, streamEnabled);
  return { data, refreshing, refreshAll, ...uplink };
}
