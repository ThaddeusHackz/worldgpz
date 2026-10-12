import { useEffect } from 'react';
import {
  applyWorkspacePreset, DASHBOARD_PANELS, moveDashboardPanel, PANEL_GROUPS,
  resetDashboardPanelSize, resizeDashboardPanel, toggleDashboardPanel, WORKSPACE_PRESETS,
} from '../lib/dashboardLayout.js';

export default function DashboardSettings({ layout, onChange, onClose }) {
  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return <div className="modal-backdrop settings-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="dashboard-settings" role="dialog" aria-modal="true" aria-labelledby="dashboard-settings-title">
      <button className="modal-close" onClick={onClose} aria-label="Close dashboard settings">×</button>
      <span className="section-kicker">WORKSPACE / LOCAL PREFERENCES</span>
      <h2 id="dashboard-settings-title">Dashboard layout</h2>
      <p className="settings-intro">Choose a focused workspace, hide panels, reorder them, or adjust panel heights. Your layout is saved in this browser; feeds and data sources do not change.</p>

      <div className="workspace-presets" aria-label="Workspace presets">
        {WORKSPACE_PRESETS.map((preset) => <button key={preset.id} className={layout.preset === preset.id ? 'active' : ''} onClick={() => onChange(applyWorkspacePreset(layout, preset.id))} aria-pressed={layout.preset === preset.id}>
          <strong>{preset.label}</strong><small>{preset.description}</small>
        </button>)}
      </div>

      <div className="layout-panel-groups">
        {PANEL_GROUPS.map((group) => {
          const panels = layout.order[group.id].map((id) => DASHBOARD_PANELS.find((panel) => panel.id === id)).filter(Boolean);
          return <section className="layout-group" key={group.id} aria-label={group.label}>
            <h3>{group.label}<small>{panels.filter((panel) => layout.visible.includes(panel.id)).length} visible</small></h3>
            <div className="layout-panel-list">
              {panels.map((panel, index) => <div className={`layout-panel-row ${layout.visible.includes(panel.id) ? '' : 'is-hidden'}`} key={panel.id}>
                <label><input type="checkbox" checked={layout.visible.includes(panel.id)} onChange={() => onChange(toggleDashboardPanel(layout, panel.id))} /><span>{panel.label}</span></label>
                <div className="layout-order-buttons">
                  <button onClick={() => onChange(moveDashboardPanel(layout, panel.id, -1))} disabled={index === 0} aria-label={`Move ${panel.label} up`} title="Move up">↑</button>
                  <button onClick={() => onChange(moveDashboardPanel(layout, panel.id, 1))} disabled={index === panels.length - 1} aria-label={`Move ${panel.label} down`} title="Move down">↓</button>
                </div>
                {group.id !== 'analytics' && <div className="layout-size-buttons">
                  <button onClick={() => onChange(resizeDashboardPanel(layout, panel.id, -40))} aria-label={`Reduce ${panel.label} height`} title="Reduce panel height">−</button>
                  <small>{layout.sizes[panel.id] ? `${layout.sizes[panel.id]}px` : 'AUTO'}</small>
                  <button onClick={() => onChange(resizeDashboardPanel(layout, panel.id, 40))} aria-label={`Increase ${panel.label} height`} title="Increase panel height">+</button>
                  {layout.sizes[panel.id] && <button onClick={() => onChange(resetDashboardPanelSize(layout, panel.id))} aria-label={`Reset ${panel.label} height`} title="Reset panel height">↺</button>}
                </div>}
              </div>)}
            </div>
          </section>;
        })}
      </div>
      <footer className="settings-footer"><small>Changes save automatically to this browser only.</small><button className="primary-button" onClick={onClose}>DONE</button></footer>
    </section>
  </div>;
}
