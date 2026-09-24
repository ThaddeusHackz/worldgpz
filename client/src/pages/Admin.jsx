import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  CircleGauge,
  Cloud,
  Database,
  Download,
  Eraser,
  ExternalLink,
  Eye,
  EyeOff,
  FileClock,
  Globe2,
  HardDrive,
  KeyRound,
  LayoutDashboard,
  List,
  LogOut,
  Menu,
  MoreHorizontal,
  Pencil,
  Plus,
  Radio,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import { Brand } from "../components/Brand.jsx";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { formatUtc, relativeTime, titleCase } from "../lib/format.js";

const blankEvent = {
  title: "",
  summary: "",
  category: "humanitarian",
  severity: "medium",
  status: "monitoring",
  region: "",
  country: "",
  latitude: 0,
  longitude: 0,
  sourceName: "WORLDGPZ Admin",
  sourceUrl: "",
};

const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "events", label: "Event registry", icon: List },
  { id: "keys", label: "Uplink keys", icon: KeyRound },
  { id: "sources", label: "Source network", icon: Database },
  { id: "audit", label: "Audit trail", icon: FileClock },
];

function EventEditor({ event, onClose, onSaved }) {
  const [form, setForm] = useState(event ? { ...event } : blankEvent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const editing = Boolean(event);
  const update = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function submit(submitEvent) {
    submitEvent.preventDefault();
    setBusy(true);
    setError("");
    const payload = {
      title: form.title,
      summary: form.summary,
      category: form.category,
      severity: form.severity,
      status: form.status,
      region: form.region,
      country: form.country,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      sourceName: form.sourceName,
      sourceUrl: form.sourceUrl || "",
      ...(editing && form.publishedAt
        ? { publishedAt: new Date(form.publishedAt).toISOString() }
        : {}),
    };
    try {
      const response = await api(
        editing ? `/api/admin/events/${event.id}` : "/api/admin/events",
        {
          method: editing ? "PATCH" : "POST",
          body: payload,
        },
      );
      onSaved(response.data, editing);
    } catch (requestError) {
      setError(
        requestError.details
          ?.map((item) => `${item.path}: ${item.message}`)
          .join(" · ") || requestError.message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="modal-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-editor-title"
    >
      <button
        className="modal-scrim"
        onClick={onClose}
        aria-label="Close event editor"
      />
      <form className="event-drawer" onSubmit={submit}>
        <header>
          <div>
            <span className="panel-kicker">Curated intelligence</span>
            <h2 id="event-editor-title">
              {editing ? "Edit signal" : "Publish new signal"}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={19} />
          </button>
        </header>
        <div className="drawer-body">
          <label className="wide">
            <span>Signal title</span>
            <input
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              minLength="5"
              maxLength="180"
              required
              placeholder="Clear, source-grounded headline"
            />
          </label>
          <label className="wide">
            <span>Summary</span>
            <textarea
              value={form.summary}
              onChange={(e) => update("summary", e.target.value)}
              minLength="10"
              maxLength="1000"
              required
              rows="4"
              placeholder="What happened, what is known, and why it matters"
            />
          </label>
          <label>
            <span>Category</span>
            <select
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
            >
              {[
                "conflict",
                "climate",
                "cyber",
                "economy",
                "humanitarian",
                "infrastructure",
                "diplomacy",
                "health",
                "seismic",
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Severity</span>
            <select
              value={form.severity}
              onChange={(e) => update("severity", e.target.value)}
            >
              {["critical", "high", "medium", "low"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Status</span>
            <select
              value={form.status}
              onChange={(e) => update("status", e.target.value)}
            >
              {["verified", "monitoring", "watch", "resolved"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Region</span>
            <input
              value={form.region}
              onChange={(e) => update("region", e.target.value)}
              required
              minLength="2"
              maxLength="80"
              placeholder="e.g. East Africa"
            />
          </label>
          <label>
            <span>Country / area</span>
            <input
              value={form.country}
              onChange={(e) => update("country", e.target.value)}
              required
              minLength="2"
              maxLength="80"
            />
          </label>
          <label>
            <span>Latitude</span>
            <input
              type="number"
              value={form.latitude}
              onChange={(e) => update("latitude", e.target.value)}
              min="-90"
              max="90"
              step="any"
              required
            />
          </label>
          <label>
            <span>Longitude</span>
            <input
              type="number"
              value={form.longitude}
              onChange={(e) => update("longitude", e.target.value)}
              min="-180"
              max="180"
              step="any"
              required
            />
          </label>
          <label>
            <span>Source name</span>
            <input
              value={form.sourceName}
              onChange={(e) => update("sourceName", e.target.value)}
              minLength="2"
              maxLength="120"
              required
            />
          </label>
          <label className="wide">
            <span>
              Primary source URL <em>optional</em>
            </span>
            <input
              type="url"
              value={form.sourceUrl}
              onChange={(e) => update("sourceUrl", e.target.value)}
              placeholder="https://…"
            />
          </label>
          {error && (
            <div className="drawer-error wide">
              <TriangleAlert size={15} /> {error}
            </div>
          )}
        </div>
        <footer>
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? (
              <>
                <RefreshCw className="spin" size={15} /> Saving
              </>
            ) : (
              <>
                <CheckCircle2 size={15} />{" "}
                {editing ? "Save changes" : "Publish signal"}
              </>
            )}
          </button>
        </footer>
      </form>
    </div>
  );
}

function AdminOverview({ data, events, setTab, onNew }) {
  const stats = data?.stats || {};
  const cards = [
    {
      label: "Curated signals",
      value: stats.totalEvents || 0,
      icon: Radio,
      note: "Registry total",
    },
    {
      label: "Critical signals",
      value: stats.criticalEvents || 0,
      icon: TriangleAlert,
      note: "Needs attention",
    },
    {
      label: "Monitored regions",
      value: stats.monitoredRegions || 0,
      icon: Globe2,
      note: "Coverage",
    },
    {
      label: "High priority",
      value: stats.highPriority || 0,
      icon: Activity,
      note: "Critical + high",
    },
  ];
  return (
    <>
      <section className="admin-title">
        <div>
          <span className="eyebrow">
            <i /> Operations console
          </span>
          <h1>Command overview</h1>
          <p>
            Manage the curated intelligence layer and audit every published
            change.
          </p>
        </div>
        <button className="button primary" onClick={onNew}>
          <Plus size={16} /> New signal
        </button>
      </section>
      <section className="admin-stat-grid">
        {cards.map(({ label, value, icon: Icon, note }) => (
          <article key={label}>
            <div>
              <Icon size={18} />
            </div>
            <p>{label}</p>
            <strong>{value}</strong>
            <span>{note}</span>
          </article>
        ))}
      </section>
      <section className="admin-overview-grid">
        <article className="admin-panel">
          <header>
            <div>
              <span className="panel-kicker">Registry activity</span>
              <h2>Recently updated signals</h2>
            </div>
            <button onClick={() => setTab("events")}>
              View registry <ChevronRight size={14} />
            </button>
          </header>
          <div className="mini-event-list">
            {events.slice(0, 5).map((event) => (
              <div key={event.id}>
                <span className={`severity-dot ${event.severity}`} />
                <div>
                  <strong>{event.title}</strong>
                  <small>
                    {event.region} ·{" "}
                    {relativeTime(event.updatedAt || event.publishedAt)}
                  </small>
                </div>
                <em>{titleCase(event.status)}</em>
              </div>
            ))}
          </div>
        </article>
        <article className="admin-panel audit-preview">
          <header>
            <div>
              <span className="panel-kicker">Accountability</span>
              <h2>Recent audit activity</h2>
            </div>
            <ShieldCheck size={18} />
          </header>
          <div>
            {(data?.audits || []).slice(0, 6).map((item) => (
              <p key={item.id}>
                <span>{titleCase(item.action)}</span>
                <small>
                  {item.actorEmail} · {relativeTime(item.createdAt)}
                </small>
              </p>
            ))}
          </div>
          {!data?.audits?.length && (
            <div className="empty-compact">No audit activity yet.</div>
          )}
        </article>
      </section>
    </>
  );
}

function EventRegistry({ events, query, setQuery, onNew, onEdit, onDelete }) {
  const filtered = useMemo(() => {
    const needle = query.toLowerCase();
    return events.filter((item) =>
      `${item.title} ${item.region} ${item.category}`
        .toLowerCase()
        .includes(needle),
    );
  }, [events, query]);
  return (
    <section>
      <div className="admin-title">
        <div>
          <span className="eyebrow">
            <i /> Curated layer
          </span>
          <h1>Event registry</h1>
          <p>
            Create, verify, update, and retire signals shown on the public
            dashboard.
          </p>
        </div>
        <button className="button primary" onClick={onNew}>
          <Plus size={16} /> New signal
        </button>
      </div>
      <article className="admin-panel registry-panel">
        <header className="registry-tools">
          <div className="admin-search">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search registry…"
            />
          </div>
          <span>{filtered.length} records</span>
        </header>
        <div className="registry-table-wrap">
          <table className="registry-table">
            <thead>
              <tr>
                <th>Signal</th>
                <th>Priority</th>
                <th>Region</th>
                <th>Status</th>
                <th>Updated</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((event) => (
                <tr key={event.id}>
                  <td>
                    <div className="registry-title">
                      <span className={`severity-dot ${event.severity}`} />
                      <div>
                        <strong>{event.title}</strong>
                        <small>
                          {titleCase(event.category)} · {event.sourceName}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`table-badge ${event.severity}`}>
                      {titleCase(event.severity)}
                    </span>
                  </td>
                  <td>{event.region}</td>
                  <td>
                    <span className="status-text">
                      <i className={event.status} />
                      {titleCase(event.status)}
                    </span>
                  </td>
                  <td>{formatUtc(event.updatedAt || event.publishedAt)}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        onClick={() => onEdit(event)}
                        aria-label={`Edit ${event.title}`}
                      >
                        <Pencil size={15} />
                      </button>
                      {event.sourceUrl && (
                        <a
                          href={event.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Open source"
                        >
                          <ExternalLink size={15} />
                        </a>
                      )}
                      <button
                        className="delete"
                        onClick={() => onDelete(event)}
                        aria-label={`Delete ${event.title}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="empty-state">
            <Search size={22} />
            <p>No registry records match that query.</p>
          </div>
        )}
      </article>
    </section>
  );
}

/**
 * Secure uplink vault — paste every provider API key once; it is persisted
 * server-side (MongoDB Atlas / local JSON), survives reloads and restarts,
 * and works from any machine. Only masked previews ever reach the browser.
 */
/**
 * Durability panel + encrypted vault transport.
 *
 * States the truth about where keys actually live, and gives the operator the
 * one action that makes them permanent on hosts with ephemeral filesystems:
 * export an encrypted blob and set it as `WORLDGPZ_VAULT`.
 */
function VaultPersistence({ meta, onImported }) {
  const persistence = meta?.persistence || {};
  const durable = Boolean(persistence.survivesRedeploy);
  const [blob, setBlob] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState(null);
  const [importText, setImportText] = useState("");

  const backendLabel =
    {
      mongodb: "MongoDB Atlas",
      "encrypted-env": "Encrypted env blob",
      "local-json": "Local JSON file",
      memory: "In-memory",
      none: "No store",
    }[persistence.backend] || "Unknown store";

  async function copyBlob() {
    setBusy("export");
    setNotice(null);
    try {
      const payload = await api("/api/admin/keys/export");
      setBlob(payload.data.blob);
      try {
        await navigator.clipboard.writeText(payload.data.blob);
        setNotice({
          kind: "ok",
          text: `${payload.data.keyCount} key(s) encrypted and copied to your clipboard. Paste it into WORLDGPZ_VAULT.`,
        });
      } catch {
        setNotice({
          kind: "warn",
          text: "Clipboard blocked by the browser — copy the blob from the box below.",
        });
      }
    } catch (requestError) {
      setNotice({ kind: "error", text: requestError.message });
    } finally {
      setBusy("");
    }
  }

  async function importBlob() {
    if (!importText.trim()) return;
    setBusy("import");
    setNotice(null);
    try {
      const payload = await api("/api/admin/keys/import", {
        method: "POST",
        body: { blob: importText.trim(), overwrite: false },
      });
      setNotice({
        kind: "ok",
        text: `Imported ${payload.meta.touched.length} key(s). Existing keys were preserved.`,
      });
      setImportText("");
      onImported?.();
    } catch (requestError) {
      setNotice({ kind: "error", text: requestError.message });
    } finally {
      setBusy("");
    }
  }

  return (
    <div className={`vault-persistence ${durable ? "durable" : "ephemeral"}`}>
      {durable ? <Cloud size={17} /> : <HardDrive size={17} />}
      <div className="vault-persistence-copy">
        <strong>
          {durable
            ? `${backendLabel} — durable across redeploys and machines`
            : `${backendLabel} — NOT durable across redeploys`}
        </strong>
        <p>{persistence.note || "Persistence status unavailable."}</p>
        {meta?.envSeedError && (
          <p className="vault-persistence-error">
            Vault blob present but unusable: {meta.envSeedError}
          </p>
        )}
        {meta?.seededFromEnv > 0 && (
          <p className="vault-persistence-ok">
            {meta.seededFromEnv} key(s) reseeded from WORLDGPZ_VAULT on this
            boot.
          </p>
        )}
      </div>
      <span className={`vault-chip ${durable ? "on" : ""}`}>
        {durable ? "PERSISTENT" : "EPHEMERAL"}
      </span>

      <div className="vault-transport">
        <p className="vault-transport-hint">
          Export produces a single AES-256-GCM encrypted string. Set it as{" "}
          <code>WORLDGPZ_VAULT</code> in your host environment and every future
          cold start reseeds these keys — no database required.
        </p>
        <div className="vault-transport-actions">
          <button
            type="button"
            className="button ghost"
            onClick={copyBlob}
            disabled={busy === "export"}
          >
            <Download size={15} />
            {busy === "export" ? "Encrypting…" : "Export encrypted vault"}
          </button>
        </div>

        {blob && (
          <div className="vault-blob">
            <label htmlFor="vault-blob-out">
              Set this as <code>WORLDGPZ_VAULT</code> in your host environment,
              then redeploy once:
            </label>
            <textarea
              id="vault-blob-out"
              readOnly
              rows={3}
              value={blob}
              onFocus={(event) => event.target.select()}
            />
          </div>
        )}

        <div className="vault-blob">
          <label htmlFor="vault-blob-in">
            Restore a vault exported from another machine:
          </label>
          <textarea
            id="vault-blob-in"
            rows={2}
            placeholder="wgv1.… paste an exported blob here"
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
          />
          <button
            type="button"
            className="button ghost"
            onClick={importBlob}
            disabled={busy === "import" || !importText.trim()}
          >
            <Upload size={15} />
            {busy === "import" ? "Decrypting…" : "Import vault"}
          </button>
        </div>

        {notice && (
          <p className={`vault-notice ${notice.kind}`}>{notice.text}</p>
        )}
      </div>
    </div>
  );
}

export function UplinkKeys({ vault, onSave, onImported }) {
  const entries = vault?.data || [];
  const meta = vault?.meta || {};
  const [drafts, setDrafts] = useState({});
  const [revealed, setRevealed] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const groups = useMemo(() => {
    const order = [];
    const map = new Map();
    for (const entry of entries) {
      if (!map.has(entry.group)) {
        map.set(entry.group, []);
        order.push(entry.group);
      }
      map.get(entry.group).push(entry);
    }
    return order.map((name) => ({ name, entries: map.get(name) }));
  }, [entries]);

  const dirty = Object.keys(drafts).length > 0;

  function draftOf(entry) {
    return Object.prototype.hasOwnProperty.call(drafts, entry.id)
      ? drafts[entry.id]
      : "";
  }

  function setDraft(id, value) {
    setDrafts((current) => ({ ...current, [id]: value }));
  }

  function clearDraft(id) {
    setDrafts((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  async function submit(submitEvent) {
    submitEvent.preventDefault();
    if (!dirty) return;
    setSaving(true);
    setError("");
    try {
      await onSave(drafts);
      setDrafts({});
    } catch (requestError) {
      setError(
        requestError.details
          ?.map((item) => `${item.path}: ${item.message}`)
          .join(" · ") || requestError.message,
      );
    } finally {
      setSaving(false);
    }
  }

  const configuredCount = entries.filter((entry) => entry.configured).length;

  return (
    <section>
      <div className="admin-title">
        <div>
          <span className="eyebrow">
            <i /> Secure uplink vault
          </span>
          <h1>Uplink keys</h1>
          <p>
            Paste every provider API key here. Keys are encrypted into the
            server database — they persist across reloads, restarts, and every
            machine you sign in from. Values never leave the server.
          </p>
        </div>
        <div className="vault-meter">
          <strong>
            {configuredCount}/{entries.length}
          </strong>
          <span>feeds configured</span>
        </div>
      </div>

      <VaultPersistence meta={meta} onImported={onImported} />

      <form onSubmit={submit}>
        {groups.map((group) => (
          <div className="vault-group" key={group.name}>
            <h2 className="vault-group-title">{group.name}</h2>
            <div className="vault-grid">
              {group.entries.map((entry) => {
                const draft = draftOf(entry);
                const touched = Object.prototype.hasOwnProperty.call(
                  drafts,
                  entry.id,
                );
                const isOpen = revealed[entry.id];
                const status = !entry.configured
                  ? "off"
                  : entry.source === "vault"
                    ? "vault"
                    : "env";
                return (
                  <article
                    className={`vault-card ${touched ? "touched" : ""}`}
                    key={entry.id}
                  >
                    <header>
                      <div className="vault-card-title">
                        <KeyRound size={15} />
                        <strong>{entry.label}</strong>
                      </div>
                      <span className={`vault-status ${status}`}>
                        <i />
                        {status === "vault"
                          ? "VAULT"
                          : status === "env"
                            ? "ENV"
                            : "OFFLINE"}
                      </span>
                    </header>
                    <p className="vault-hint">{entry.hint}</p>
                    <div className="vault-input-row">
                      <input
                        type={
                          entry.kind === "secret" && !isOpen
                            ? "password"
                            : "text"
                        }
                        value={draft}
                        onChange={(event) =>
                          setDraft(entry.id, event.target.value)
                        }
                        placeholder={
                          entry.kind === "text"
                            ? entry.value || `Set ${entry.id}`
                            : entry.masked
                              ? `${entry.masked} — paste to replace`
                              : `Paste ${entry.id}`
                        }
                        autoComplete="off"
                        spellCheck={false}
                        aria-label={entry.label}
                      />
                      {entry.kind === "secret" && (
                        <button
                          type="button"
                          className="vault-reveal"
                          onClick={() =>
                            setRevealed((current) => ({
                              ...current,
                              [entry.id]: !current[entry.id],
                            }))
                          }
                          aria-label={isOpen ? "Hide input" : "Show input"}
                        >
                          {isOpen ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      )}
                    </div>
                    <footer>
                      <code>{entry.id}</code>
                      <div className="vault-card-actions">
                        {touched && (
                          <button
                            type="button"
                            onClick={() => clearDraft(entry.id)}
                          >
                            {draft === "" ? "Keep saved" : "Undo"}
                          </button>
                        )}
                        {entry.source === "vault" && !touched && (
                          <button
                            type="button"
                            className="danger"
                            onClick={() => setDraft(entry.id, "")}
                          >
                            <Eraser size={13} /> Clear
                          </button>
                        )}
                      </div>
                    </footer>
                  </article>
                );
              })}
            </div>
          </div>
        ))}

        {error && (
          <div className="inline-alert">
            <TriangleAlert size={16} /> {error}
          </div>
        )}

        <div className="vault-save-bar">
          <div className="security-note compact">
            <ShieldCheck size={18} />
            <div>
              <strong>Server-side only</strong>
              <p>
                The API returns masked previews (last 4 characters) — full
                values stay in the database and provider adapters.
              </p>
            </div>
          </div>
          <div className="vault-save-actions">
            {dirty && (
              <span className="vault-dirty">
                {Object.keys(drafts).length} pending change
                {Object.keys(drafts).length > 1 ? "s" : ""}
              </span>
            )}
            <button
              type="button"
              className="button secondary"
              disabled={saving || !dirty}
              onClick={() => setDrafts({})}
            >
              Discard
            </button>
            <button
              className="button primary"
              disabled={saving || !dirty}
              type="submit"
            >
              {saving ? (
                <>
                  <RefreshCw className="spin" size={15} /> Sealing…
                </>
              ) : (
                <>
                  <Save size={15} /> Save keys to secure storage
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

function SourcesView({ sources }) {
  return (
    <section>
      <div className="admin-title">
        <div>
          <span className="eyebrow">
            <i /> Provider mesh
          </span>
          <h1>Source network</h1>
          <p>Read-only operational health for every dashboard data provider.</p>
        </div>
      </div>
      <div className="source-admin-grid">
        {sources.map((source) => (
          <article className="admin-panel" key={source.id}>
            <header>
              <div className="source-admin-icon">
                <Database size={19} />
              </div>
              <span className={`source-state ${source.status}`}>
                <i /> {titleCase(source.status)}
              </span>
            </header>
            <h2>{source.name}</h2>
            <p>
              {source.type} intelligence · {source.coverage || "Global"}{" "}
              coverage
            </p>
            <dl>
              <div>
                <dt>Cadence</dt>
                <dd>{source.cadence || "On demand"}</dd>
              </div>
              <div>
                <dt>Last latency</dt>
                <dd>
                  {source.latencyMs != null ? `${source.latencyMs}ms` : "—"}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
      <div className="security-note">
        <ShieldCheck size={20} />
        <div>
          <strong>Secrets remain server-side</strong>
          <p>
            Provider keys live in the server database (env fallback supported),
            are applied to the provider mesh at boot, and are never embedded in
            the frontend bundle — only masked previews are returned by the API.
            Manage them any time in <b>Uplink keys</b>.
          </p>
        </div>
      </div>
    </section>
  );
}

function AuditView({ audits }) {
  return (
    <section>
      <div className="admin-title">
        <div>
          <span className="eyebrow">
            <i /> Immutable context
          </span>
          <h1>Audit trail</h1>
          <p>
            Review administrator sign-ins and changes to curated intelligence.
          </p>
        </div>
      </div>
      <article className="admin-panel audit-table-panel">
        <div className="audit-timeline">
          {audits.map((item) => (
            <div key={item.id} className="audit-entry">
              <span>
                <ShieldCheck size={15} />
              </span>
              <div>
                <strong>{titleCase(item.action)}</strong>
                <p>
                  {item.entityType}
                  {item.entityId ? ` · ${item.entityId}` : ""}
                </p>
              </div>
              <div>
                <strong>{item.actorEmail}</strong>
                <small>{formatUtc(item.createdAt)} UTC</small>
              </div>
            </div>
          ))}
          {audits.length === 0 && (
            <div className="empty-state">
              <FileClock size={22} />
              <p>No audit entries yet.</p>
            </div>
          )}
        </div>
      </article>
    </section>
  );
}

export default function Admin() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");
  const [overview, setOverview] = useState(null);
  const [events, setEvents] = useState([]);
  const [sources, setSources] = useState([]);
  const [audits, setAudits] = useState([]);
  const [vault, setVault] = useState(null);
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [navOpen, setNavOpen] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const [
        overviewResponse,
        eventsResponse,
        sourcesResponse,
        auditResponse,
        vaultResponse,
      ] = await Promise.all([
        api("/api/admin/overview"),
        api("/api/admin/events"),
        api("/api/v1/sources"),
        api("/api/admin/audit?limit=100"),
        api("/api/admin/keys"),
      ]);
      setOverview(overviewResponse.data);
      setEvents(eventsResponse.data);
      setSources(sourcesResponse.data);
      setAudits(auditResponse.data);
      setVault(vaultResponse);
    } catch (requestError) {
      if (requestError.status === 401) {
        await logout();
        navigate("/login");
      } else setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }, [logout, navigate]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  function openNew() {
    setEditor(null);
    setEditorOpen(true);
  }
  /** Re-read the vault after an import so the grid reflects the new keys. */
  function refreshVault() {
    return api("/api/admin/keys")
      .then((payload) => {
        setVault(payload);
        setToast("Vault imported and re-applied to the provider mesh");
      })
      .catch(() => {});
  }
  async function saveKeys(keys) {
    const response = await api("/api/admin/keys", {
      method: "PUT",
      body: { keys },
    });
    setVault(response);
    setToast(
      `${Object.keys(keys).length} key${Object.keys(keys).length > 1 ? "s" : ""} sealed in secure storage`,
    );
    // Warm source status so freshly saved keys show up right away.
    api("/api/v1/sources")
      .then((payload) => setSources(payload.data))
      .catch(() => {});
  }
  function saved(event, editing) {
    setEvents((current) =>
      editing
        ? current.map((item) => (item.id === event.id ? event : item))
        : [event, ...current],
    );
    setEditorOpen(false);
    setToast(
      editing ? "Signal updated successfully" : "Signal published successfully",
    );
    load();
  }
  async function remove(event) {
    if (
      !window.confirm(
        `Delete “${event.title}”? This action is recorded in the audit trail.`,
      )
    )
      return;
    try {
      await api(`/api/admin/events/${event.id}`, { method: "DELETE" });
      setEvents((current) => current.filter((item) => item.id !== event.id));
      setToast("Signal deleted");
      load();
    } catch (requestError) {
      setError(requestError.message);
    }
  }
  async function signOut() {
    await logout();
    navigate("/");
  }

  return (
    <div className="admin-shell">
      <div className="hud-grid" aria-hidden="true" />
      {navOpen && (
        <button
          className="admin-nav-scrim"
          onClick={() => setNavOpen(false)}
          aria-label="Close menu"
        />
      )}
      <aside className={`admin-sidebar ${navOpen ? "open" : ""}`}>
        <div className="admin-brand">
          <Brand />
          <button onClick={() => setNavOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>
        <div className="admin-label">Command console</div>
        <nav>
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => {
                setTab(id);
                setNavOpen(false);
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === "events" && <em>{events.length}</em>}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-foot">
          <Link to="/">
            <ArrowLeft size={16} /> Public monitor
          </Link>
          <button onClick={signOut}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar">
          <button className="mobile-menu" onClick={() => setNavOpen(true)}>
            <Menu size={19} />
          </button>
          <div className="admin-breadcrumb">
            <span>WORLDGPZ · GOD&apos;S EYE</span>
            <ChevronRight size={13} />
            <strong>{tabs.find((item) => item.id === tab)?.label}</strong>
          </div>
          <div className="admin-user">
            <div>
              <strong>{user?.name}</strong>
              <span>{user?.email}</span>
            </div>
            <span>
              {user?.name
                ?.split(" ")
                .map((part) => part[0])
                .slice(0, 2)
                .join("") || "AD"}
            </span>
          </div>
        </header>
        <main className="admin-main">
          {error && (
            <div className="inline-alert">
              <TriangleAlert size={16} /> {error}
              <button onClick={load}>Retry</button>
            </div>
          )}
          {busy && !overview ? (
            <div className="admin-loading">
              <RefreshCw className="spin" size={25} />
              <p>Loading secure workspace…</p>
            </div>
          ) : (
            <>
              {tab === "overview" && (
                <AdminOverview
                  data={overview}
                  events={events}
                  setTab={setTab}
                  onNew={openNew}
                />
              )}
              {tab === "events" && (
                <EventRegistry
                  events={events}
                  query={query}
                  setQuery={setQuery}
                  onNew={openNew}
                  onEdit={(event) => {
                    setEditor(event);
                    setEditorOpen(true);
                  }}
                  onDelete={remove}
                />
              )}
              {tab === "keys" && (
                <UplinkKeys
                  vault={vault}
                  onSave={saveKeys}
                  onImported={refreshVault}
                />
              )}
              {tab === "sources" && <SourcesView sources={sources} />}
              {tab === "audit" && <AuditView audits={audits} />}
            </>
          )}
        </main>
      </div>
      {editorOpen && (
        <EventEditor
          event={editor}
          onClose={() => setEditorOpen(false)}
          onSaved={saved}
        />
      )}
      {toast && (
        <div className="toast">
          <CheckCircle2 size={16} /> {toast}
        </div>
      )}
    </div>
  );
}
