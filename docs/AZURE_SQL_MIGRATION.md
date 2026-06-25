# Supabase → Azure SQL Migration

This guide moves **database data** from Supabase (PostgreSQL) to **Azure SQL Database**, and optionally files to **Azure Blob Storage**.

## Important differences

| Supabase | Azure SQL |
|----------|-----------|
| PostgreSQL | SQL Server (T-SQL) |
| `auth.users` + RLS | `dbo.users` table — you need a new auth layer |
| Supabase Storage | Azure Blob Storage |
| Edge Functions (Deno) | Azure Functions / App Service API |

Migrating data is **step 1**. The React app still uses `@supabase/supabase-js` today — you will need a backend API (or Azure API + Entra ID) to replace Supabase Auth and direct table access.

---

## Prerequisites

1. **Azure SQL Database** created (Server + database, firewall allows your IP)
2. **Supabase service role key** (Settings → API → `service_role`)
3. Optional: **Supabase DB connection string** for password hash export (Settings → Database)
4. Node.js 18+

---

## Step 1: Create Azure SQL schema

In Azure Portal → SQL Database → Query editor (or SSMS / Azure Data Studio), run in order:

1. `database/azure-sql/schema/001_create_tables.sql`
2. `database/azure-sql/schema/002_seed_lookup_data.sql`

---

## Step 2: Configure migration script

```bash
cd database/azure-sql/migrate
cp .env.example .env
```

Edit `.env`:

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Optional — enables password hash migration
SUPABASE_DB_URL=postgresql://postgres.[ref]:[password]@...pooler.supabase.com:5432/postgres

AZURE_SQL_SERVER=your-server.database.windows.net
AZURE_SQL_DATABASE=hainan
AZURE_SQL_USER=sqladmin
AZURE_SQL_PASSWORD=...
```

---

## Step 3: Run migration

```bash
npm install
npm run migrate:dry-run   # export + preview row counts
npm run migrate           # export from Supabase + import to Azure SQL
```

Exports are saved under `migrate/export/*.json` for audit/retry.

### Tables migrated

| Table | Source |
|-------|--------|
| `users` | Supabase `auth.users` |
| `profiles` | `public.profiles` |
| `study_loan_applications` | public |
| `study_loan_recipients` | public |
| `guarantors` | public |
| `study_loan_payments` | public |
| `scheduled_notifications` | public |
| `fcm_tokens` | public |
| `push_subscriptions` | public |
| `user_notifications` | public |
| `association_options` | public |
| `guarantor_relationship_options` | public |

---

## Step 4: Migrate storage files (optional)

Loan documents live in Supabase Storage bucket `study-loan-documents`.

1. Create Azure Storage account + container `study-loan-documents`
2. Add to `.env`:

```env
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...
```

3. Install Azure SDK and run:

```bash
npm install @azure/storage-blob
node migrate-storage.mjs
```

File **paths** in the database (`offer_letter_path`, etc.) stay the same; only the storage backend changes.

---

## Step 5: Verify data

Run in Azure SQL Query editor:

```sql
SELECT 'users' AS t, COUNT(*) AS n FROM dbo.users
UNION ALL SELECT 'profiles', COUNT(*) FROM dbo.profiles
UNION ALL SELECT 'study_loan_applications', COUNT(*) FROM dbo.study_loan_applications
UNION ALL SELECT 'study_loan_recipients', COUNT(*) FROM dbo.study_loan_recipients
UNION ALL SELECT 'guarantors', COUNT(*) FROM dbo.guarantors
UNION ALL SELECT 'study_loan_payments', COUNT(*) FROM dbo.study_loan_payments;
```

Compare counts with Supabase Dashboard → Table Editor.

---

## Password hashes

- **Without `SUPABASE_DB_URL`:** user IDs and emails migrate; users must reset passwords on the new system.
- **With `SUPABASE_DB_URL`:** bcrypt hashes from `auth.users.encrypted_password` copy to `dbo.users.password_hash` (compatible if your new API uses bcrypt verification).

---

## Re-run / truncate

Set `TRUNCATE_BEFORE_IMPORT=1` in `.env` to delete existing Azure rows before import (destructive).

Or use `npm run export-only` then manually import from `export/*.json`.

---

## Next steps (app cutover)

1. Build a **backend API** (Node/Express, Azure Functions, or .NET) that queries Azure SQL instead of Supabase client
2. Replace **Supabase Auth** with Azure Entra External ID, Auth0, or custom JWT auth using `dbo.users`
3. Replace **Supabase Storage** signed URLs with Azure Blob SAS URLs
4. Port **Edge Functions** to Azure Functions (FCM + scheduled notifications)
5. Update frontend env vars to point at the new API

See `database/azure-sql/schema/` for the target schema your API should use.
