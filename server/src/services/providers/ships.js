import WebSocket from 'ws';
import { BaseProvider } from './base.js';
import { validCoordinate, safeNumber } from '../../lib/http.js';

const STRATEGIC_BOXES = [
  [[24, 54], [28, 58]], [[28, 32], [32, 34]], [[-2, 98], [6, 106]],
  [[49, -6], [52, 3]], [[7, -81], [11, -78]], [[5, 105], [22, 122]],
  [[30, -6], [45, 36]], [[12, 36], [30, 44]],
];

export class ShipsProvider extends BaseProvider {
  constructor() {
    super('ships', { ttlMs: 20_000, requiredKeys: ['AISSTREAM_API_KEY'], emptyValue: [] });
    this.ships = new Map();
    this.socket = null;
    this.reconnectTimer = null;
    this.reconnectDelay = 5_000;
    this.closedByUser = false;
  }

  async _fetchFresh() {
    this.#connect();
    this.#prune();
    const positions = [...this.ships.values()].sort((a, b) => b.timestamp - a.timestamp).slice(0, 700);
    if (this.socket?.readyState !== WebSocket.OPEN) positions.fallback = true;
    return positions;
  }

  #connect() {
    if (this.socket && [WebSocket.CONNECTING, WebSocket.OPEN].includes(this.socket.readyState)) return;
    if (this.closedByUser || !this.secret('AISSTREAM_API_KEY')) return;
    this.socket = new WebSocket('wss://stream.aisstream.io/v0/stream');
    this.socket.on('open', () => {
      this.reconnectDelay = 5_000;
      this.status = 'online';
      this.lastError = null;
      this.socket.send(JSON.stringify({
        APIKey: this.secret('AISSTREAM_API_KEY'), BoundingBoxes: STRATEGIC_BOXES,
        FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
      }));
    });
    this.socket.on('message', (raw) => {
      try {
        const packet = JSON.parse(raw.toString());
        const metadata = packet.MetaData || {};
        const report = packet.Message?.PositionReport;
        if (!report) return;
        const latitude = safeNumber(report.Latitude ?? metadata.latitude);
        const longitude = safeNumber(report.Longitude ?? metadata.longitude);
        if (!validCoordinate(latitude, longitude)) return;
        const mmsi = String(metadata.MMSI || report.UserID || '');
        if (!mmsi) return;
        const timestamp = Date.now();
        this.ships.set(mmsi, {
          id: `ais-${mmsi}`, type: 'ship', mmsi, name: String(metadata.ShipName || 'Unknown vessel').trim(),
          latitude, longitude, lat: latitude, lon: longitude,
          heading: safeNumber(report.TrueHeading, safeNumber(report.Cog, 0)),
          speed: safeNumber(report.Sog, 0), status: safeNumber(report.NavigationalStatus),
          timestamp, source: 'AISStream',
        });
        if (this.ships.size > 1_000) this.#prune(true);
        this.data = [...this.ships.values()].slice(0, 700);
        this.lastSuccess = timestamp;
      } catch (error) {
        this.lastError = `Skipped malformed AIS message: ${error.message}`.slice(0, 160);
      }
    });
    this.socket.on('error', (error) => {
      this.lastError = String(error.message || 'AISStream connection failed').slice(0, 180);
    });
    this.socket.on('close', () => {
      if (this.closedByUser) return;
      this.status = this.ships.size ? 'degraded' : 'offline';
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => this.#connect(), this.reconnectDelay);
      this.reconnectDelay = Math.min(60_000, Math.round(this.reconnectDelay * 1.8));
      this.reconnectTimer.unref?.();
    });
  }

  #prune(force = false) {
    const cutoff = Date.now() - 10 * 60_000;
    for (const [mmsi, vessel] of this.ships) {
      if (vessel.timestamp < cutoff || (force && this.ships.size > 850)) this.ships.delete(mmsi);
    }
  }

  stop() {
    this.closedByUser = true;
    clearTimeout(this.reconnectTimer);
    this.socket?.close();
    this.socket = null;
  }

  getHealth() {
    return { ...super.getHealth(), connected: this.socket?.readyState === WebSocket.OPEN, dataPoints: this.ships.size };
  }
}
