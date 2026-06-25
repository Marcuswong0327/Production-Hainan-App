/**
 * Migrate data from Supabase (PostgreSQL) to Azure SQL Database.
 *
 * Usage:
 *   cp .env.example .env   # fill in credentials
 *   npm install
 *   npm run migrate:dry-run   # preview counts
 *   npm run migrate           # export + import
 *
 * Requires Azure SQL schema applied first:
 *   ../schema/001_create_tables.sql
 *   ../schema/002_seed_lookup_data.sql
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { Agent, fetch as undiciFetch } from 'undici';
import sql from 'mssql';
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXPORT_DIR = path.join(__dirname, 'export');

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const EXPORT_ONLY = args.has('--export-only');
const IMPORT_ONLY = args.has('--import-only');
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 100);
const TRUNCATE = process.env.TRUNCATE_BEFORE_IMPORT === '1';
const FETCH_RETRIES = Number(process.env.FETCH_RETRIES || 3);
const FETCH_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS || 60000);

const PUBLIC_TABLES = [
  'profiles',
  'association_options',
  'guarantor_relationship_options',
  'study_loan_applications',
  'study_loan_recipients',
  'guarantors',
  'study_loan_payments',
  'scheduled_notifications',
  'fcm_tokens',
  'push_subscriptions',
  'user_notifications',
];

/** Tables imported in FK-safe order */
const IMPORT_ORDER = [
  { table: 'users', file: 'users.json' },
  { table: 'profiles', file: 'profiles.json' },
  { table: 'association_options', file: 'association_options.json' },
  { table: 'guarantor_relationship_options', file: 'guarantor_relationship_options.json' },
  { table: 'study_loan_applications', file: 'study_loan_applications.json' },
  { table: 'study_loan_recipients', file: 'study_loan_recipients.json' },
  { table: 'guarantors', file: 'guarantors.json' },
  { table: 'study_loan_payments', file: 'study_loan_payments.json' },
  { table: 'scheduled_notifications', file: 'scheduled_notifications.json' },
  { table: 'fcm_tokens', file: 'fcm_tokens.json' },
  { table: 'push_subscriptions', file: 'push_subscriptions.json' },
  { table: 'user_notifications', file: 'user_notifications.json' },
];

function requireEnv(name) {
  const v = process.env[name];
  if (!v?.trim()) throw new Error(`Missing required env: ${name}`);
  let trimmed = v.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    trimmed = trimmed.slice(1, -1);
  }
  return trimmed;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isMissingTableError(error) {
  const msg = error?.message ?? String(error);
  return /Could not find the table|PGRST205|schema cache/i.test(msg);
}

function isNetworkError(err) {
  const msg = err?.message ?? String(err);
  const cause = err?.cause?.message ?? '';
  return /fetch failed|ECONNRESET|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT|ENOTFOUND/i.test(`${msg} ${cause}`);
}

async function withRetry(label, fn) {
  let lastErr;
  for (let attempt = 1; attempt <= FETCH_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < FETCH_RETRIES && isNetworkError(err)) {
        const wait = attempt * 2000;
        console.warn(`  ${label}: network error (attempt ${attempt}/${FETCH_RETRIES}), retry in ${wait / 1000}s…`);
        await sleep(wait);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

const supabaseFetchAgent = new Agent({
  connect: { timeout: FETCH_TIMEOUT_MS },
});

function fetchWithTimeout(url, options = {}) {
  return undiciFetch(url, {
    ...options,
    dispatcher: supabaseFetchAgent,
    signal: options.signal ?? AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

function getSupabase() {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchWithTimeout },
  });
}

function getAzureConfig(database) {
  return {
    server: requireEnv('AZURE_SQL_SERVER'),
    database: database ?? requireEnv('AZURE_SQL_DATABASE'),
    user: requireEnv('AZURE_SQL_USER'),
    password: requireEnv('AZURE_SQL_PASSWORD'),
    options: {
      encrypt: true,
      trustServerCertificate: false,
      enableArithAbort: true,
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    connectionTimeout: 30000,
  };
}

/** Connect to target database (Azure SQL does not support USE to switch DB). */
async function connectAzurePool() {
  const targetDb = requireEnv('AZURE_SQL_DATABASE');
  const base = getAzureConfig();

  try {
    return await sql.connect(base);
  } catch (directErr) {
    if (!/Login failed|Cannot open database/i.test(directErr.message)) {
      throw directErr;
    }

    console.warn(`  Cannot connect to database '${targetDb}': ${directErr.message}`);

    const masterPool = await sql.connect(getAzureConfig('master'));
    try {
      const { recordset } = await masterPool.request().query(
        `SELECT name FROM sys.databases WHERE state_desc = 'ONLINE' ORDER BY name`
      );
      const names = recordset.map((r) => r.name);
      const match = names.find((n) => n.toLowerCase() === targetDb.toLowerCase());

      throw new Error(
        `Login works on master but not on database '${targetDb}'.\n` +
          `  Available databases: ${names.join(', ') || '(none)'}\n\n` +
          `  Azure SQL does NOT support USE to switch databases.\n` +
          `  In SSMS: New Connection → same server → set database to '${match ?? targetDb}' → run:\n` +
          `    CREATE USER [${requireEnv('AZURE_SQL_USER')}] FOR LOGIN [${requireEnv('AZURE_SQL_USER')}];\n` +
          `    ALTER ROLE db_owner ADD MEMBER [${requireEnv('AZURE_SQL_USER')}];\n` +
          `  Or use Azure Portal → SQL database → Query editor (Entra login).`
      );
    } finally {
      await masterPool.close();
    }
  }
}

async function fetchAllRows(supabase, table) {
  const rows = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await withRetry(table, () =>
      supabase.from(table).select('*').range(from, from + pageSize - 1)
    );
    if (error) {
      if (isMissingTableError(error)) {
        console.warn(`  ${table}: skipped (not in Supabase — Azure seed/empty used)`);
        return [];
      }
      throw new Error(`${table}: ${error.message}`);
    }
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function fetchAuthUsers(supabase) {
  const users = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    let data;
    let error;
    try {
      ({ data, error } = await withRetry('auth.users', () =>
        supabase.auth.admin.listUsers({ page, perPage })
      ));
    } catch (err) {
      throw new Error(`auth.users: ${err.message} (cannot reach ${requireEnv('SUPABASE_URL')} — check network/VPN/firewall)`);
    }
    if (error) throw new Error(`auth.users: ${error.message}`);
    const batch = data.users ?? [];
    users.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }

  return users.map((u) => ({
    id: u.id,
    email: u.email ?? '',
    email_confirmed: !!u.email_confirmed_at,
    created_at: u.created_at,
    updated_at: u.updated_at ?? u.created_at,
    last_sign_in_at: u.last_sign_in_at ?? null,
    password_hash: null,
  }));
}

async function fetchAuthUsersWithPasswords() {
  const dbUrl = process.env.SUPABASE_DB_URL?.trim();
  if (!dbUrl) return null;

  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const { rows } = await client.query(
      `SELECT id, email, encrypted_password AS password_hash, email_confirmed_at,
              created_at, updated_at, last_sign_in_at
       FROM auth.users
       ORDER BY created_at`
    );
    return rows.map((r) => ({
      id: r.id,
      email: r.email ?? '',
      password_hash: r.password_hash ?? null,
      email_confirmed: !!r.email_confirmed_at,
      created_at: r.created_at?.toISOString?.() ?? r.created_at,
      updated_at: r.updated_at?.toISOString?.() ?? r.updated_at,
      last_sign_in_at: r.last_sign_in_at?.toISOString?.() ?? r.last_sign_in_at ?? null,
    }));
  } catch (err) {
    const host = (() => {
      try {
        return new URL(dbUrl.replace(/^postgresql:/, 'http:')).hostname;
      } catch {
        return '(unknown host)';
      }
    })();
    console.warn(
      `  Warning: SUPABASE_DB_URL failed (${host}): ${err.message}\n` +
        '  Falling back to Auth Admin API (users migrate without password hashes).\n' +
        '  Fix: Supabase Dashboard → Settings → Database → Connection string → URI (Session pooler).\n' +
        '  Or comment out SUPABASE_DB_URL in .env to skip direct DB access.\n'
    );
    return null;
  } finally {
    await client.end().catch(() => {});
  }
}

function writeJson(name, data) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
  const file = path.join(EXPORT_DIR, name);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  return file;
}

function readJson(name) {
  const file = path.join(EXPORT_DIR, name);
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function toGuid(v) {
  if (v == null || v === '') return null;
  return String(v);
}

function toDate(v) {
  if (v == null || v === '') return null;
  return new Date(v);
}

function toBool(v) {
  if (typeof v === 'boolean') return v;
  if (v === 't' || v === 'true' || v === 1) return true;
  return false;
}

/** Map Supabase row keys to Azure column names where they differ */
let profileEmailByUserId = null;

function loadProfileEmails() {
  if (!profileEmailByUserId) {
    profileEmailByUserId = new Map(
      readJson('profiles.json').map((p) => [String(p.id), p.email])
    );
  }
  return profileEmailByUserId;
}

function defaultStr(r, col, fallback) {
  if (r[col] == null || String(r[col]).trim() === '') r[col] = fallback;
}

function defaultInt(r, col, fallback = 0) {
  if (r[col] == null || r[col] === '') r[col] = fallback;
}

function normalizeRow(table, row) {
  const r = { ...row };
  if (table === 'user_notifications' && 'read' in r) {
    r.read = toBool(r.read);
  }
  if (table === 'study_loan_applications') {
    if (!r.email?.trim()) {
      const fromProfile = loadProfileEmails().get(String(r.user_id));
      r.email = fromProfile?.trim() || `legacy-${r.user_id}@migrated.local`;
    }
    defaultStr(r, 'association', 'Unknown');
    defaultStr(r, 'full_name', 'Unknown');
    defaultStr(r, 'age', '0');
    defaultStr(r, 'university', 'Unknown');
    defaultStr(r, 'courses', 'Unknown');
    defaultStr(r, 'admission_date', '1970-01-01');
    defaultStr(r, 'expected_graduation_date', '1970-01-01');
    defaultStr(r, 'phone_number', '0');
    defaultStr(r, 'guarantor_relationship', 'Other');
    defaultStr(r, 'guarantor_phone_number', '0');
    defaultStr(r, 'loan_type', 'unknown');
    defaultStr(r, 'user_id', 'unknown');
    defaultStr(r, 'status', 'pending');
    defaultInt(r, 'loan_amount');
    defaultInt(r, 'total_paid');
    defaultInt(r, 'payments_made');
  }
  if (table === 'study_loan_recipients') {
    defaultStr(r, 'full_name_en', r.full_name?.trim() || r.full_name_en?.trim() || 'Unknown');
    defaultStr(r, 'course', r.courses?.trim() || r.course?.trim() || '—');
    if (!r.email?.trim()) {
      r.email = r.id ? `recipient-${r.id}@migrated.local` : 'unknown@migrated.local';
    }
    defaultStr(r, 'phone_number', '0');
    defaultStr(r, 'association', 'Unknown');
    defaultStr(r, 'university', 'Unknown');
    defaultStr(r, 'status', 'active');
    defaultInt(r, 'loan_amount');
    defaultInt(r, 'total_paid');
    defaultInt(r, 'payments_made');
  }
  if (table === 'guarantors') {
    defaultStr(r, 'student_id', r.student_id ?? '');
  }
  if (table === 'study_loan_payments') {
    defaultInt(r, 'amount');
    defaultStr(r, 'recipient_id', r.recipient_id ?? '');
  }
  if (table === 'users' && !r.email?.trim()) {
    r.email = r.id ? `user-${r.id}@migrated.local` : 'unknown@migrated.local';
  }
  if (table === 'profiles' && !r.email?.trim()) {
    r.email = r.id ? `profile-${r.id}@migrated.local` : 'unknown@migrated.local';
    defaultStr(r, 'role', 'public');
    defaultInt(r, 'points');
  }
  if (table === 'user_notifications') {
    defaultStr(r, 'title', 'Notification');
    defaultStr(r, 'message', '');
    defaultStr(r, 'type', 'system');
  }
  if (table === 'scheduled_notifications') {
    defaultStr(r, 'target', 'all');
    defaultStr(r, 'message', '');
    defaultInt(r, 'sent_count');
  }
  return r;
}

async function exportFromSupabase() {
  const supabase = getSupabase();
  console.log('Exporting from Supabase...\n');

  let users = await fetchAuthUsersWithPasswords();
  if (users) {
    console.log(`  users (auth.users + passwords via DB): ${users.length}`);
  } else {
    users = await fetchAuthUsers(supabase);
    console.log(`  users (auth admin API, no passwords): ${users.length}`);
    console.log('  Tip: set SUPABASE_DB_URL to migrate password hashes.');
  }
  writeJson('users.json', users);

  for (const table of PUBLIC_TABLES) {
    const rows = await fetchAllRows(supabase, table);
    writeJson(`${table}.json`, rows);
    console.log(`  ${table}: ${rows.length}`);
  }

  console.log(`\nExport saved to ${EXPORT_DIR}`);
}

const TABLE_COLUMNS = {
  users: ['id', 'email', 'password_hash', 'email_confirmed', 'created_at', 'updated_at', 'last_sign_in_at'],
  profiles: ['id', 'email', 'name', 'role', 'association_id', 'points', 'created_at', 'updated_at'],
  association_options: ['id', 'label', 'sort_order', 'created_at'],
  guarantor_relationship_options: ['id', 'label', 'sort_order', 'created_at'],
  study_loan_applications: [
    'id', 'user_id', 'association', 'full_name', 'age', 'email', 'university', 'courses',
    'admission_date', 'expected_graduation_date', 'phone_number', 'offer_letter_path',
    'ic_front_path', 'ic_back_path', 'guarantor_ic_front_path', 'guarantor_ic_back_path',
    'guarantor_relationship', 'guarantor_phone_number', 'loan_type', 'loan_amount', 'status',
    'applied_at', 'reviewed_at', 'rejection_reason', 'total_paid', 'payments_made',
    'created_at', 'updated_at',
  ],
  study_loan_recipients: [
    'id', 'full_name_en', 'full_name_zh', 'full_name', 'full_name_chinese', 'email', 'phone_number',
    'association', 'university', 'course', 'courses', 'loan_type', 'admission_date',
    'expected_graduation_date', 'loan_amount', 'total_paid', 'payments_made', 'status',
    'offer_letter_path', 'student_ic_front_back_path', 'ic_front_path', 'ic_back_path', 'notes',
    'created_at', 'updated_at',
  ],
  guarantors: [
    'id', 'student_id', 'guarantor_1_zh', 'guarantor_1_en', 'guarantor_1_ic', 'guarantor_1_address',
    'guarantor_1_sign_date', 'guarantor_2_zh', 'guarantor_2_en', 'guarantor_2_ic', 'guarantor_2_address',
    'guarantor_2_sign_date', 'guarantor_2_age', 'guarantor_info_pic', 'created_at', 'updated_at',
  ],
  study_loan_payments: ['id', 'recipient_id', 'amount', 'paid_at', 'payment_date', 'payment_month', 'receipt_path', 'notes'],
  scheduled_notifications: ['id', 'target', 'message', 'schedule_at', 'created_at', 'sent_at', 'sent_count', 'error_log'],
  fcm_tokens: ['id', 'user_id', 'token', 'device_name', 'created_at', 'updated_at'],
  push_subscriptions: ['id', 'user_id', 'endpoint', 'p256dh', 'auth', 'created_at'],
  user_notifications: ['id', 'user_id', 'title', 'message', 'type', 'read', 'created_at'],
};

const GUID_COLUMNS = new Set([
  'id', 'user_id', 'student_id', 'recipient_id',
]);

const DATE_COLUMNS = new Set([
  'created_at', 'updated_at', 'applied_at', 'reviewed_at', 'schedule_at', 'sent_at',
  'paid_at', 'last_sign_in_at', 'payment_date',
]);

const BOOL_COLUMNS = new Set(['email_confirmed', 'read']);

function quoteCol(c) {
  if (c === 'read' || c === 'auth') return `[${c}]`;
  return c;
}

async function insertBatch(pool, table, rows) {
  if (!rows.length) return 0;

  const columns = TABLE_COLUMNS[table];
  if (!columns) throw new Error(`No column map for table: ${table}`);

  const request = pool.request();
  const valuesClauses = [];

  rows.forEach((raw, rowIdx) => {
    const row = normalizeRow(table, raw);
    const placeholders = columns.map((col) => {
      const param = `${col}_${rowIdx}`;
      let val = row[col];

      if (GUID_COLUMNS.has(col)) val = toGuid(val);
      else if (DATE_COLUMNS.has(col)) val = toDate(val);
      else if (BOOL_COLUMNS.has(col)) val = toBool(val);

      if (val === undefined) val = null;
      request.input(param, val);
      return `@${param}`;
    });
    valuesClauses.push(`(${placeholders.join(', ')})`);
  });

  const colList = columns.map(quoteCol).join(', ');
  const insertQuery = `
    INSERT INTO dbo.${table} (${colList})
    VALUES ${valuesClauses.join(', ')};
  `;

  try {
    await request.query(insertQuery);
  } catch (err) {
    if (String(err.message).includes('Violation of PRIMARY KEY') || String(err.message).includes('duplicate')) {
      // Fall back to row-by-row skip duplicates
      let inserted = 0;
      for (const raw of rows) {
        const row = normalizeRow(table, raw);
        const req = pool.request();
        columns.forEach((col) => {
          let val = row[col];
          if (GUID_COLUMNS.has(col)) val = toGuid(val);
          else if (DATE_COLUMNS.has(col)) val = toDate(val);
          else if (BOOL_COLUMNS.has(col)) val = toBool(val);
          req.input(col, val ?? null);
        });
        try {
          await req.query(`
            INSERT INTO dbo.${table} (${colList})
            VALUES (${columns.map((c) => `@${c}`).join(', ')});
          `);
          inserted += 1;
        } catch {
          /* skip duplicate */
        }
      }
      return inserted;
    }
    throw err;
  }

  return rows.length;
}

const TRUNCATE_ORDER = [
  'user_notifications', 'push_subscriptions', 'fcm_tokens', 'scheduled_notifications',
  'study_loan_payments', 'guarantors', 'study_loan_recipients', 'study_loan_applications',
  'guarantor_relationship_options', 'association_options', 'profiles', 'users',
];

async function importToAzure() {
  if (DRY_RUN) {
    console.log('Import preview from export/*.json (no Azure connection):\n');
    for (const { table, file } of IMPORT_ORDER) {
      const rows = readJson(file);
      console.log(`  ${table}: ${rows.length}${rows.length ? ' (ready to import)' : ' (skipped)'}`);
    }
    return;
  }

  let pool;
  try {
    pool = await connectAzurePool();
  } catch (err) {
    const loginUser = process.env.AZURE_SQL_USER ?? '(not set)';
    throw new Error(
      `Azure SQL connection failed for user '${loginUser}': ${err.message}\n` +
        '  If test:azure works on master but not your DB, run the SSMS fix in MIGRATE_RUNBOOK.md'
    );
  }

  profileEmailByUserId = null;
  loadProfileEmails();

  try {
    if (TRUNCATE) {
      console.log('Truncating target tables...');
      for (const table of TRUNCATE_ORDER) {
        await pool.request().query(`DELETE FROM dbo.${table};`).catch(() => {});
      }
    }

    for (const { table, file } of IMPORT_ORDER) {
      const rows = readJson(file);
      if (!rows.length) {
        console.log(`  ${table}: 0 (skipped)`);
        continue;
      }

      let imported = 0;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        imported += await insertBatch(pool, table, batch);
      }
      console.log(`  ${table}: ${imported}/${rows.length} imported`);
    }
  } finally {
    await pool.close();
  }
}

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===\n' : '=== Supabase → Azure SQL Migration ===\n');

  if (IMPORT_ONLY) {
    if (!fs.existsSync(EXPORT_DIR)) {
      throw new Error('No export/ folder. Run npm run migrate first (or export-only).');
    }
    console.log('Import-only mode — using existing export/*.json\n');
  } else if (!EXPORT_ONLY) {
    await exportFromSupabase();
  } else if (!fs.existsSync(EXPORT_DIR)) {
    throw new Error('No export/ folder. Run without --export-only first.');
  }

  if (!DRY_RUN && (!EXPORT_ONLY || IMPORT_ONLY)) {
    console.log('\nImporting to Azure SQL...\n');
    await importToAzure();
    console.log('\nMigration complete.');
  } else if (DRY_RUN) {
    console.log('\nImport preview (dry-run):\n');
    await importToAzure();
  } else {
    console.log('\nExport-only mode — skipping Azure import.');
  }
}

main().catch((err) => {
  console.error('\nMigration failed:', err.message);
  process.exit(1);
});
