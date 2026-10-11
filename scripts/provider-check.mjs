import 'dotenv/config';
import { ProviderRegistry } from '../server/src/services/providers/registry.js';

// Read-only public-source checks. No private credentials or upstream error URLs printed.
const registry = ProviderRegistry.createDefault({ secretResolver: () => '' });
const names = ['usgs', 'eonet', 'weather', 'iss'];
const report = [];
try {
  for (const name of names) {
    const provider = registry.get(name);
    const started = Date.now();
    const result = await provider.fetch();
    report.push({ provider: name, status: provider.status, records: Array.isArray(result.data) ? result.data.length : result.data ? 1 : 0, durationMs: Date.now() - started });
  }
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), scope: 'Public sources only; paid/credentialed integrations not verified.', report }, null, 2));
} finally { registry.stop(); }
