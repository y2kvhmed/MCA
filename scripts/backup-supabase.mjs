// One-off data backup via the Supabase REST API (read-only).
// Uses the service-role key from .env (needed after RLS lockdown; falls back to
// the anon key). Writes one JSON file per table into backups/<timestamp>/.
// Run: node scripts/backup-supabase.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const envText = fs.readFileSync(path.join(root, '.env'), 'utf8');
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const URL = env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!URL || !KEY) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL, and either SUPABASE_SERVICE_ROLE_KEY or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}
if (!env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('SUPABASE_SERVICE_ROLE_KEY not set — using the anon key (will fail once RLS is locked down).');
}
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.join(root, 'backups', stamp);
fs.mkdirSync(outDir, { recursive: true });

// Known tables/views in the project (the anon key cannot list them, so we enumerate).
const TABLES = [
  'app_users',
  'app_settings',
  'schools',
  'teacher_schools',
  'classes',
  'enrollments',
  'assignments',
  'submissions',
  'assignment_comments',
  'study_materials',
  'materials',
  'lessons',
  'videos',
  'recordings',
  'student_notes',
  'messages',
  'private_messages',
  'notifications',
  'attendance_sheets',
  'attendance_records',
  'attendance',
  'calendar_events',
  'push_tokens',
  'push_subscriptions',
  'file_metadata',
  'recording_audit_log',
  'tests',
  'student_test_results',
];

async function main() {
  const tables = TABLES;
  console.log(`Backing up ${tables.length} tables/views to ${outDir}\n`);

  const summary = [];
  const pageSize = 1000;

  for (const t of tables) {
    let rows = [];
    let offset = 0;
    try {
      while (true) {
        const res = await fetch(
          `${URL}/rest/v1/${encodeURIComponent(t)}?select=*&limit=${pageSize}&offset=${offset}`,
          { headers }
        );
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const batch = await res.json();
        rows = rows.concat(batch);
        if (batch.length < pageSize) break;
        offset += pageSize;
        if (offset > 200000) break; // safety cap
      }
      fs.writeFileSync(path.join(outDir, `${t}.json`), JSON.stringify(rows, null, 2));
      summary.push({ table: t, rows: rows.length, status: 'ok' });
      console.log(`  ok   ${t} (${rows.length} rows)`);
    } catch (e) {
      summary.push({ table: t, rows: 0, status: `ERROR: ${e.message}` });
      console.log(`  FAIL ${t} -> ${e.message}`);
    }
  }

  const total = summary.reduce((n, s) => n + (typeof s.rows === 'number' ? s.rows : 0), 0);
  console.log(`\nDone. ${summary.length} objects, ${total} rows total.`);
  console.log(`Location: ${outDir}`);
  const failed = summary.filter((s) => String(s.status).startsWith('ERROR'));
  if (failed.length) console.log(`Failed: ${failed.map((f) => f.table).join(', ')}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
