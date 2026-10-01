import 'dotenv/config';
import { Store } from '../lib/store.js';
import { BASELINE_WATCHPOINTS } from './baseline.js';

const store = new Store();
if (!store.persistent) {
  console.error('[Seed] DATABASE_URL is required to seed PostgreSQL.');
  process.exitCode = 1;
} else {
  try {
    await store.initialize();
    for (const event of BASELINE_WATCHPOINTS) {
      await store.query(
        `INSERT INTO events (type,severity,title,description,latitude,longitude,metadata,source,external_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)
         ON CONFLICT (source, external_id) WHERE external_id IS NOT NULL DO UPDATE SET
           title=EXCLUDED.title, description=EXCLUDED.description, updated_at=NOW()`,
        [event.type, event.severity, event.title, event.description, event.latitude, event.longitude,
          JSON.stringify({ region: event.region, editorialContext: true }), event.source, event.id],
      );
    }
    console.info(`[Seed] Inserted ${BASELINE_WATCHPOINTS.length} editorial context point(s).`);
  } catch (error) {
    console.error('[Seed] Failed:', error.message);
    process.exitCode = 1;
  } finally {
    await store.close();
  }
}
