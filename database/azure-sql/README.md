# Azure SQL Database

Target schema and migration tooling for moving from Supabase (PostgreSQL) to Azure SQL.

## Layout

```
azure-sql/
├── schema/
│   ├── 001_create_tables.sql    # T-SQL schema (run on Azure SQL first)
│   └── 002_seed_lookup_data.sql # Default association / guarantor options
└── migrate/
    ├── migrate.mjs              # Supabase → Azure SQL data migration
    ├── migrate-storage.mjs        # Supabase Storage → Azure Blob (optional)
    ├── .env.example
    └── package.json
```

## Quick start

1. Apply schema on Azure SQL (see files in `schema/`)
2. Configure `migrate/.env` from `.env.example`
3. Run:

```bash
cd migrate
npm install
npm run migrate
```

Full guide: [docs/AZURE_SQL_MIGRATION.md](../../docs/AZURE_SQL_MIGRATION.md)

## Notes

- Supabase **Row Level Security** is not ported — enforce access in your API layer.
- **auth.users** maps to `dbo.users`; profiles FK to users.id is preserved.
- Legacy columns on `study_loan_recipients` (`full_name`, `courses`, etc.) are kept for compatibility with existing Supabase data.
