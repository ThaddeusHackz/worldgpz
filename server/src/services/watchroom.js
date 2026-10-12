import crypto from 'node:crypto';
import { analyzeMission } from './mission.js';

const rank = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
const severity = (events) => events.reduce((best, event) => rank[event.severity] > rank[best] ? event.severity : best, 'info');
const citation = (event) => ({ id: event.id, title: event.title, url: event.url, source: event.source });
const digest = (value) => crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);

export async function collectObservations(registry, { timeoutMs = 15_000 } = {}) {
  const names = ['usgs', 'eonet', 'acled', 'firms', 'reliefweb', 'news', 'gdelt'];
  const unavailableSources = [];
  const results = await Promise.all(names.map(async (name) => {
    const provider = registry.get(name);
    if (!provider) { unavailableSources.push(name); return []; }
    let timer;
    try {
      const result = await Promise.race([
        Promise.resolve().then(() => provider.fetch()),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Observation deadline exceeded')), timeoutMs); }),
      ]);
      if (result.error || result.stale || result.configured === false || ['offline', 'degraded', 'unconfigured'].includes(provider.status)) unavailableSources.push(name);
      return (Array.isArray(result.data) ? result.data : []).slice(0, 1000).map((event) => ({ ...event,
        provenance: { ...event.provenance, provider: name, stale: Boolean(result.stale) },
      }));
    } catch { unavailableSources.push(name); return []; }
    finally { clearTimeout(timer); }
  }));
  return { events: results.flat(), unavailableSources };
}

export function buildWatchroom(events, options = {}) {
  const mission = analyzeMission(events, options);
  const groups = new Map();
  for (const event of mission.priorities) {
    if (event.latitude === null || event.longitude === null) continue;
    // Fixed 5-degree cells: proximity only; never infer shared actors or causality.
    const key = `${Math.floor((event.latitude + 90) / 5)}:${Math.floor((event.longitude + 180) / 5)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(event);
  }
  const clusters = [...groups].map(([key, signals]) => {
    const latitude = Number((signals.reduce((sum, event) => sum + event.latitude, 0) / signals.length).toFixed(4));
    const longitude = Number((signals.reduce((sum, event) => sum + event.longitude, 0) / signals.length).toFixed(4));
    return { id: `geo-${key.replace(':', '-')}`, label: `Observed reports near ${latitude}°, ${longitude}°`, latitude, longitude,
      count: signals.length, sourceCount: new Set(signals.map((event) => event.source)).size, severity: severity(signals),
      updatedAt: new Date(Math.max(...signals.map((event) => event.time))).toISOString(), eventIds: signals.slice(0, 50).map((event) => event.id), signals,
    };
  }).sort((a, b) => rank[b.severity] - rank[a.severity] || b.count - a.count || a.id.localeCompare(b.id));
  const thread = (id, title, signals, description) => {
    const selected = signals.slice(0, 8);
    return { id, title, summary: `${signals.length} reported observation(s) from ${new Set(signals.map((event) => event.source)).size} source label(s). ${description} Showing up to eight reports; follow citations for context.`,
      severity: severity(signals), signals: selected, citations: selected.map(citation),
      method: 'Deterministic evidence grouping; proximity or event type only, not causal linkage or independent verification.',
    };
  };
  const threads = clusters.slice(0, 8).map((cluster) => thread(`thread-${cluster.id}`, cluster.label, cluster.signals, 'Grouped in the same fixed five-degree geographic cell.'));
  const unlocated = new Map();
  for (const event of mission.priorities.filter((event) => event.latitude === null || event.longitude === null)) {
    if (!unlocated.has(event.type)) unlocated.set(event.type, []);
    unlocated.get(event.type).push(event);
  }
  for (const [type, signals] of [...unlocated].sort(([a], [b]) => a.localeCompare(b)).slice(0, 4)) {
    threads.push(thread(`thread-unlocated-${digest(type)}`, `${type} reports · location unavailable`, signals, 'These reports lack verified coordinates; grouped by event type only.'));
  }
  const now = Date.parse(mission.generatedAt);
  const start = Math.floor((now - mission.windowHours * 3_600_000) / 3_600_000) * 3_600_000;
  const buckets = new Map();
  for (let time = start; time <= now; time += 3_600_000) buckets.set(time, { time: new Date(time).toISOString(), count: 0, highCount: 0 });
  for (const event of mission.priorities) {
    const bucket = buckets.get(Math.floor(event.time / 3_600_000) * 3_600_000);
    if (bucket) { bucket.count++; if (['critical', 'high'].includes(event.severity)) bucket.highCount++; }
  }
  return { generatedAt: mission.generatedAt, windowHours: mission.windowHours, summary: { ...mission.summary, hotspotCount: clusters.length, threadCount: threads.length },
    hotspots: clusters.slice(0, 24).map(({ signals, ...cluster }) => cluster), timeline: [...buckets.values()], threads,
    coverage: mission.coverage,
    limitations: [...mission.limitations, 'Geographic hotspots use fixed 5-degree cells and observed coordinate averages, not inferred locations. Counts are reports, not unique incidents or proof of causality.',
      'Output capped at 24 hotspots, 12 threads, 8 signals per thread and 50 event IDs per hotspot. Hourly timeline includes partial boundary hours.'],
  };
}

const STOPWORDS = new Set('a an and are as at be by can do for from has have how i in is it me of on or please reports show the there this to today what whats when where which with you latest current happening tell about world summarize summary any anything happened happen going recent recently now some were was did does been new update updates near around'.split(' '));
const CATEGORY_SYNONYMS = new Map([
  ...['earthquake', 'earthquakes', 'quake', 'quakes', 'seismic'].map((word) => [word, 'seismic']),
  ...['wildfire', 'wildfires', 'fire', 'fires', 'thermal'].map((word) => [word, 'fire']),
  ...['conflict', 'conflicts', 'violence'].map((word) => [word, 'conflict']),
]);
const GENERIC_PRIORITY_WORDS = new Set('needs need attention highest high severity priorities priority urgent critical important most top observations observation available events event risks risk'.split(' '));
const wordsOf = (text) => new Set(String(text || '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || []);
// Whole-word matching with simple plural/-ing/-ed handling; prefixes only for terms of 4+ letters ("flood" <-> "flooding").
// Raw substrings are deliberately avoided: "us" must not match "USGS" or "focus", and "war" must not match "warning".
export function termMatches(term, words) {
  const singular = term.length > 3 && term.endsWith('s') ? term.slice(0, -1) : null;
  const stem = term.length >= 7 && term.endsWith('ing') ? term.slice(0, -3) : term.length >= 6 && term.endsWith('ed') ? term.slice(0, -2) : null;
  for (const word of words) {
    if (word === term || word === `${term}s` || word === `${term}es` || (singular && word === singular) || (term.length >= 4 && word.startsWith(term)) || (stem && word.startsWith(stem))) return true;
  }
  return false;
}
export function answerQuestion(question, events, options = {}) {
  const mission = analyzeMission(events, options);
  const tokens = [...new Set(question.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) || [])].filter((word) => !STOPWORDS.has(word)).slice(0, 30);
  const categories = new Set(tokens.map((token) => CATEGORY_SYNONYMS.get(token)).filter(Boolean));
  const priorityQuery = tokens.every((token) => GENERIC_PRIORITY_WORDS.has(token));
  const specificTerms = priorityQuery ? [] : tokens.filter((token) => !GENERIC_PRIORITY_WORDS.has(token));
  const matchedTerms = new Set();
  const matches = mission.priorities.map((event) => {
    const words = wordsOf(`${event.title} ${event.type} ${event.source}`);
    const type = String(event.type || '').toLowerCase();
    const categoryMatch = categories.has(type);
    let score = priorityQuery ? 0 : Number(categoryMatch);
    for (const token of specificTerms) {
      if (termMatches(token, words) || CATEGORY_SYNONYMS.get(token) === type) { score += 1; matchedTerms.add(token); }
    }
    return { event, score };
  }).filter((item) => priorityQuery || item.score > 0).sort((a, b) => b.score - a.score || rank[b.event.severity] - rank[a.event.severity] || b.event.time - a.event.time || a.event.id.localeCompare(b.event.id));
  const signals = matches.slice(0, 8).map((item) => item.event);
  const citations = signals.map(citation);
  const unmatchedTerms = specificTerms.filter((token) => !matchedTerms.has(token));
  const coverageNote = signals.length && unmatchedTerms.length ? ` No loaded report in this window mentions: ${unmatchedTerms.join(', ')}. Results below match other question terms only.` : '';
  const answer = signals.length
    ? `Found ${matches.length} matching report(s) in the last ${mission.windowHours} hours.${coverageNote} ${priorityQuery ? 'General priority query; showing observed reports ranked by reported severity, then time.' : `Ranked by explicit event-category synonyms${categories.size ? ` (${[...categories].join(', ')})` : ''} and question-word overlap, then reported severity and time.`}\n\n${signals.map((event, index) => `${index + 1}. ${event.title} — ${event.source}, ${new Date(event.time).toISOString()} [${event.id}]`).join('\n')}\n\nThese are reported observations, not independently verified findings. I cannot establish causes, forecast outcomes, or infer events absent from the feeds.`
    : `No matching dated reports were found in the last ${mission.windowHours} hours for this question. Try a place, event type, or keyword shown in the watchroom. Absence of coverage does not establish safety or disprove an event.`;
  return { generatedAt: mission.generatedAt, question, answer, method: 'deterministic source retrieval; explicit category synonyms + whole-word keyword overlap (simple plural/-ing/-ed forms, 4+ letter prefixes); general priority queries use reported severity and observation time; no model or paid request',
    windowHours: mission.windowHours, matchedCount: matches.length, matchedTerms: specificTerms.filter((token) => matchedTerms.has(token)), unmatchedTerms, citations, signals, limitations: mission.limitations };
}
