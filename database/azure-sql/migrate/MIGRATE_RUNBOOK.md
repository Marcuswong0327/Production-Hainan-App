# Full migration runbook — Supabase → Azure SQL

Run these in order. Paths assume repo root: `Production-Hainan-App`.

---

## Part A — SSMS (one-time schema)

Connect to **Azure SQL** in SSMS, then open and execute each file (F5):

1. `database\azure-sql\schema\001_create_tables.sql`
2. `database\azure-sql\schema\002_seed_lookup_data.sql`

**Optional — create guarantor table in Supabase** (only if you added custom options there later):

In **Supabase Dashboard → SQL Editor**, paste and run:

`database\migrations\20250402120000_guarantor_relationship_options.sql`

If you skip this, Azure keeps the 7 default guarantor rows from step 2 above.

---

## Part B — Configure `.env`

In IDE, open `database\azure-sql\migrate\.env`:

```env
SUPABASE_URL=https://oyldgeairjcetcavibun.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

AZURE_SQL_SERVER=your-server.database.windows.net
AZURE_SQL_DATABASE=your-database-name
AZURE_SQL_USER=sqladmin
AZURE_SQL_PASSWORD=your-password

TRUNCATE_BEFORE_IMPORT=0

# Optional: password hashes from auth.users
# SUPABASE_DB_URL=postgresql://postgres.oyldgeairjcetcavibun:...@....pooler.supabase.com:5432/postgres

# Required for storage step only:
# AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...
```

---

## Part C — IDE terminal (database + auth.users + tables)

```powershell
cd C:\Users\ACER\Downloads\Production-Hainan-App\database\azure-sql\migrate

npm install

npm run migrate:dry-run
```

Check row counts in the output, then:

```powershell
npm run migrate
```

This migrates:

| Source (Supabase) | Azure target |
|-------------------|--------------|
| `auth.users` (Auth API) | `dbo.users` |
| `public.profiles` | `dbo.profiles` |
| All other public tables | Matching `dbo.*` tables |
| Missing `guarantor_relationship_options` | Skipped → **seed rows kept** |
| Path columns on loan rows | Same columns (e.g. `offer_letter_path`) |

Export files are saved under `migrate\export\` for backup.

---

## Part D — IDE terminal (file storage)

**Before running:**

1. Azure Portal → **Storage account** → create if needed
2. Copy **Connection string** from Access keys
3. Add `AZURE_STORAGE_CONNECTION_STRING=...` to `.env`

```powershell
cd C:\Users\ACER\Downloads\Production-Hainan-App\database\azure-sql\migrate

npm install

npm run migrate:storage
```

This copies bucket `study-loan-documents` → Azure Blob and fills **`dbo.file_objects`**.

---

## Part E — SSMS (verify after migration)

Run in Azure SQL:

```sql
-- Row counts
SELECT 'users' AS t, COUNT(*) AS n FROM dbo.users
UNION ALL SELECT 'profiles', COUNT(*) FROM dbo.profiles
UNION ALL SELECT 'study_loan_applications', COUNT(*) FROM dbo.study_loan_applications
UNION ALL SELECT 'study_loan_recipients', COUNT(*) FROM dbo.study_loan_recipients
UNION ALL SELECT 'guarantors', COUNT(*) FROM dbo.guarantors
UNION ALL SELECT 'study_loan_payments', COUNT(*) FROM dbo.study_loan_payments
UNION ALL SELECT 'guarantor_relationship_options', COUNT(*) FROM dbo.guarantor_relationship_options
UNION ALL SELECT 'file_objects', COUNT(*) FROM dbo.file_objects;

-- Sample users (from auth.users)
SELECT id, email, email_confirmed, created_at FROM dbo.users ORDER BY created_at;

-- Sample file metadata (after migrate:storage)
SELECT TOP 20 storage_path, container_name, size_bytes, blob_url FROM dbo.file_objects;

-- Paths on applications still point at same logical paths
SELECT TOP 5 id, full_name, offer_letter_path, ic_front_path
FROM dbo.study_loan_applications
WHERE offer_letter_path IS NOT NULL OR ic_front_path IS NOT NULL;
```

Compare counts with **Supabase Dashboard → Table Editor** (public tables) and **Authentication → Users** (should match `dbo.users`).

---

## Troubleshooting

| Issue | Action |
|-------|--------|
| Connect timeout to Supabase | Retry `npm run migrate`; check VPN/firewall |
| Missing table skipped | Expected for tables never created in Supabase |
| Re-import from saved export | `npm run migrate:import-only` |
| Wipe Azure and re-import all | Set `TRUNCATE_BEFORE_IMPORT=1` in `.env`, then `npm run migrate` |

---

## Quick command summary

```powershell
# Terminal
cd C:\Users\ACER\Downloads\Production-Hainan-App\database\azure-sql\migrate
npm install
npm run migrate:dry-run
npm run migrate
npm run migrate:storage
```

```sql
-- SSMS (after migrate)
SELECT COUNT(*) FROM dbo.users;
SELECT COUNT(*) FROM dbo.file_objects;
```
