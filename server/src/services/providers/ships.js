import { ProviderBase } from "./base.js";

/**
 * AISStream — live ship positions over a WebSocket relay.
 * Docs: https://aisstream.io/documentation
 *
 * The key never reaches the browser. A single server-side relay subscribes to
 * the global bounding box, keeps the most recent vessel state in memory, and
 * reconnects with exponential backoff when the stream drops.
 */
const STREAM_URL = "wss://stream.aisstream.io/v0/stream";
const MAX_VESSELS = 500;
const MAX_BACKOFF_MS = 30_000;
const RECONNECT_RESET_MS = 60_000;

export class AisStreamService extends ProviderBase {
  constructor(config, options = {}) {
    super(config, {
      name: "AISStream",
      group: "Ships",
      cacheSeconds: 15,
      ...options,
    });
    this.WebSocketImpl = options.WebSocketImpl || globalThis.WebSocket;
    this.vessels = new Map(); // mmsi -> vessel record
    this.socket = null;
    this.connecting = false;
    this.connectedAt = null;
    this.lastMessageAt = null;
    this.messageCount = 0;
    this.lastError = null;
    this.lastErrorCode = null;
    this.disconnectedAt = null;
    this.reconnectDelayMs = 2_000;
    this.reconnectTimer = null;
    this.closed = false;
  }

  get configured() {
    return Boolean(this.config.aisStreamApiKey);
  }

  #subscribe() {
    if (!this.socket || this.socket.readyState !== this.WebSocketImpl.OPEN)
      return;
    this.socket.send(
      JSON.stringify({
        APIKey: this.config.aisStreamApiKey,
        BoundingBoxes: [
          [
            [-90, -180],
            [90, 180],
          ],
        ],
        FilterMessageTypes: ["PositionReport", "ShipStaticData"],
      }),
    );
  }

  #handleMessage(raw) {
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }
    const type = payload.MessageType;
    const mmsi = payload.MetaData?.MMSI;
    if (mmsi == null) return;

    const vessel = this.vessels.get(mmsi) || {
      mmsi,
      name: null,
      destination: null,
    };
    const now = new Date().toISOString();

    if (type === "PositionReport") {
      const report = payload.Message?.PositionReport || {};
      if (
        Number.isFinite(report.Latitude) &&
        Number.isFinite(report.Longitude)
      ) {
        vessel.latitude = report.Latitude;
        vessel.longitude = report.Longitude;
        vessel.speedKnots = Number.isFinite(report.Sog) ? report.Sog : null;
        vessel.course = Number.isFinite(report.Cog) ? report.Cog : null;
        vessel.heading = Number.isFinite(report.TrueHeading)
          ? report.TrueHeading
          : null;
      }
      vessel.timestamp = now;
    } else if (type === "ShipStaticData") {
      const staticData = payload.Message?.ShipStaticData || {};
      if (staticData.ShipName) vessel.name = staticData.ShipName;
      if (staticData.Destination) vessel.destination = staticData.Destination;
      vessel.timestamp = now;
    }

    this.vessels.set(mmsi, vessel);
    if (this.vessels.size > MAX_VESSELS) {
      const oldest = this.vessels.keys().next().value;
      if (oldest != null) this.vessels.delete(oldest);
    }
    this.messageCount += 1;
    this.lastMessageAt = now;
  }

  #scheduleReconnect() {
    if (this.closed || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.#connect();
    }, this.reconnectDelayMs);
    this.reconnectTimer.unref?.();
    this.reconnectDelayMs = Math.min(MAX_BACKOFF_MS, this.reconnectDelayMs * 2);
  }

  #connect() {
    if (this.closed || this.connecting || this.socket) return;
    if (typeof this.WebSocketImpl !== "function") {
      this.lastError = "WebSocket is not available in this runtime";
      return;
    }
    this.connecting = true;
    try {
      const socket = new this.WebSocketImpl(STREAM_URL);
      this.socket = socket;
      socket.onopen = () => {
        this.connecting = false;
        this.connectedAt = new Date().toISOString();
        this.reconnectDelayMs = 2_000;
        this.lastError = null;
        this.lastErrorCode = null;
        this.#subscribe();
      };
      socket.onmessage = (event) => {
        const raw =
          typeof event?.data === "string"
            ? event.data
            : event?.data?.toString?.();
        if (raw != null) this.#handleMessage(raw);
      };
      socket.onerror = (event) => {
        const underlying = event?.error || event;
        this.lastError =
          underlying?.cause?.code === "CERT_HAS_EXPIRED" ||
          underlying?.code === "CERT_HAS_EXPIRED"
            ? "AISStream TLS certificate is invalid upstream"
            : "AISStream connection could not be established";
        this.lastErrorCode = "upstream-unavailable";
      };
      socket.onclose = () => {
        this.socket = null;
        this.connecting = false;
        this.disconnectedAt = new Date().toISOString();
        this.#scheduleReconnect();
      };
    } catch (error) {
      this.connecting = false;
      this.socket = null;
      this.lastError = error.message;
      this.#scheduleReconnect();
    }
  }

  /** Start the relay on first use. Safe to call repeatedly. */
  ensureConnected() {
    if (!this.configured || this.closed) return;
    this.#connect();
  }

  async snapshot() {
    if (!this.configured) return this.notConfigured();
    this.ensureConnected();

    const vessels = [...this.vessels.values()]
      .sort((a, b) =>
        String(b.timestamp || "").localeCompare(String(a.timestamp || "")),
      )
      .slice(0, 40);
    const connected = Boolean(
      this.socket && this.socket.readyState === this.WebSocketImpl.OPEN,
    );
    const status = connected
      ? "operational"
      : this.lastError
        ? "degraded"
        : this.connecting || this.socket
          ? "connecting"
          : "pending";
    this.cache = {
      configured: true,
      status,
      name: this.name,
      group: this.group,
      checkedAt: new Date().toISOString(),
      connected,
      vessels,
      vesselCount: this.vessels.size,
      messageCount: this.messageCount,
      lastMessageAt: this.lastMessageAt,
      connectedAt: this.connectedAt,
      disconnectedAt: this.disconnectedAt || null,
      lastError: this.lastError,
      error: this.lastError,
      errorCode: this.lastErrorCode || null,
      providerNotice:
        status === "degraded"
          ? "Upstream WebSocket unavailable; secure TLS verification remains enabled"
          : null,
      window: "live AIS relay",
    };
    return this.cache;
  }

  /** Graceful shutdown: stop reconnects and close the socket. */
  close() {
    this.closed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      try {
        this.socket.onclose = null;
        this.socket.close();
      } catch {
        // socket already closed
      }
      this.socket = null;
    }
  }
}
