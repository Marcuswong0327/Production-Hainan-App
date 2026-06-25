#!/usr/bin/env node
/**
 * Copy Supabase Storage → Azure Blob and register rows in dbo.file_objects.
 *
 * Prerequisites: 001_create_tables.sql applied on Azure SQL; .env configured.
 *
 *   npm install @azure/storage-blob
 *   npm run migrate:storage
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { BlobServiceClient } from '@azure/storage-blob';
import sql from 'mssql';
import { randomUUID } from 'node:crypto';

const BUCKET = 'study-loan-documents';

function requireEnv(name) {
  const v = process.env[name];
  if (!v?.trim()) throw new Error(`Missing env: ${name}`);
  return v.trim();
}

function getAzureSqlConfig() {
  return {
    server: requireEnv('AZURE_SQL_SERVER'),
    database: requireEnv('AZURE_SQL_DATABASE'),
    user: requireEnv('AZURE_SQL_USER'),
    password: requireEnv('AZURE_SQL_PASSWORD'),
    options: { encrypt: true, trustServerCertificate: false },
  };
}

async function listAllObjects(supabase, bucket, prefix = '') {
  const items = [];
  const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) throw error;
  for (const entry of data ?? []) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id) {
      items.push({ path, metadata: entry.metadata });
    } else {
      items.push(...(await listAllObjects(supabase, bucket, path)));
    }
  }
  return items;
}

async function upsertFileObject(pool, { storagePath, blobUrl, contentType, sizeBytes }) {
  const id = randomUUID();
  await pool.request()
    .input('id', sql.UniqueIdentifier, id)
    .input('storage_path', sql.NVarChar, storagePath)
    .input('container_name', sql.NVarChar, BUCKET)
    .input('blob_url', sql.NVarChar, blobUrl)
    .input('content_type', sql.NVarChar, contentType)
    .input('size_bytes', sql.BigInt, sizeBytes)
    .query(`
      IF NOT EXISTS (
        SELECT 1 FROM dbo.file_objects
        WHERE storage_path = @storage_path AND container_name = @container_name
      )
        INSERT INTO dbo.file_objects (id, storage_path, container_name, blob_url, content_type, size_bytes)
        VALUES (@id, @storage_path, @container_name, @blob_url, @content_type, @size_bytes);
      ELSE
        UPDATE dbo.file_objects
        SET blob_url = @blob_url, content_type = @content_type, size_bytes = @size_bytes, uploaded_at = SYSDATETIMEOFFSET()
        WHERE storage_path = @storage_path AND container_name = @container_name;
    `);
}

async function main() {
  const supabase = createClient(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  );
  const blobService = BlobServiceClient.fromConnectionString(
    requireEnv('AZURE_STORAGE_CONNECTION_STRING')
  );
  const container = blobService.getContainerClient(BUCKET);
  await container.createIfNotExists();

  const pool = await sql.connect(getAzureSqlConfig());

  console.log(`Listing Supabase Storage bucket "${BUCKET}"...\n`);
  const objects = await listAllObjects(supabase, BUCKET);
  console.log(`Found ${objects.length} file(s).\n`);

  let ok = 0;
  let skip = 0;

  try {
    for (const { path: objectPath } of objects) {
      const { data, error } = await supabase.storage.from(BUCKET).download(objectPath);
      if (error) {
        console.warn(`  SKIP ${objectPath}: ${error.message}`);
        skip += 1;
        continue;
      }
      const buffer = Buffer.from(await data.arrayBuffer());
      const contentType = data.type || 'application/octet-stream';
      const block = container.getBlockBlobClient(objectPath);
      await block.upload(buffer, buffer.length, {
        blobHTTPHeaders: { blobContentType: contentType },
      });
      const blobUrl = block.url;
      await upsertFileObject(pool, {
        storagePath: objectPath,
        blobUrl,
        contentType,
        sizeBytes: buffer.length,
      });
      console.log(`  OK ${objectPath} (${buffer.length} bytes)`);
      ok += 1;
    }
  } finally {
    await pool.close();
  }

  console.log(`\nStorage migration complete: ${ok} uploaded, ${skip} skipped.`);
}

main().catch((err) => {
  console.error('\nStorage migration failed:', err.message);
  process.exit(1);
});
