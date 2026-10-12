function serialize(value) {
  try { return JSON.stringify(value ?? null); } catch { return 'null'; }
}

export class PulseEngine {
  constructor(registry, { intervalMs = 30_000, heartbeatMs = 15_000 } = {}) {
    this.registry = registry;
    this.intervalMs = intervalMs;
    this.heartbeatMs = heartbeatMs;
    this.clients = new Set();
    this.timers = [];
  }
  start() {
    this.timers.push(setInterval(() => this.broadcast(), this.intervalMs));
    this.timers.push(setInterval(() => {
      for (const response of this.clients) this.#write(response, 'heartbeat', { timestamp: Date.now() });
    }, this.heartbeatMs));
    this.timers.forEach((timer) => timer.unref?.());
  }
  addClient(response) {
    response.status(200);
    response.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    response.flushHeaders();
    this.clients.add(response);
    response.on('close', () => this.clients.delete(response));
    this.#write(response, 'connected', { timestamp: Date.now(), clients: this.clients.size });
    this.#write(response, 'health', this.registry.getHealthReport());
    const map = {
      seismic: 'usgs', natural: 'eonet', conflict: 'acled', fire: 'firms', weather: 'weather',
      flight: 'flights', ship: 'ships', news: 'news', market: 'markets', briefing: 'openai', iss: 'iss',
      outbreaks: 'outbreaks', predictions: 'predictions', launches: 'launches',
    };
    for (const [eventName, providerName] of Object.entries(map)) {
      const data = this.registry.getData(providerName);
      if (data !== null) this.#write(response, eventName, data);
    }
    this.#write(response, 'pulse', { timestamp: Date.now(), clients: this.clients.size });
  }
  broadcast() {
    if (!this.clients.size) return;
    this.#broadcastEvent('health', this.registry.getHealthReport());
    this.#broadcastEvent('pulse', { timestamp: Date.now(), clients: this.clients.size });
    const mapping = { seismic: 'usgs', natural: 'eonet', conflict: 'acled', fire: 'firms', weather: 'weather', flight: 'flights', ship: 'ships', news: 'news', market: 'markets', briefing: 'openai', iss: 'iss', outbreaks: 'outbreaks', predictions: 'predictions', launches: 'launches' };
    for (const [eventName, providerName] of Object.entries(mapping)) {
      const data = this.registry.getData(providerName);
      if (data !== null) this.#broadcastEvent(eventName, data);
    }
  }
  #write(response, eventName, data) {
    if (response.writableEnded) { this.clients.delete(response); return; }
    try { response.write(`event: ${eventName}\ndata: ${serialize(data)}\n\n`); }
    catch { this.clients.delete(response); }
  }
  #broadcastEvent(eventName, data) { for (const response of this.clients) this.#write(response, eventName, data); }
  stop() {
    this.timers.forEach(clearInterval);
    this.timers = [];
    for (const response of this.clients) { this.#write(response, 'shutdown', { message: 'Server shutting down' }); response.end(); }
    this.clients.clear();
  }
}
