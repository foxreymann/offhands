import { loadEnv } from '../libs/env.js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

loadEnv()

const __dirname = dirname(fileURLToPath(import.meta.url))
const SUPABASE_URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

async function runSql(sql) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })
  if (!res.ok) {
    console.log('Note: exec_sql RPC may not exist — run migrations manually in Supabase SQL Editor')
    console.log(await res.text())
    return false
  }
  return true
}

const migrations = ['001_schema.sql', '002_whatsapp.sql']

console.log('OffHands migrations')
console.log('Run these files in Supabase SQL Editor if auto-migrate fails:\n')

for (const file of migrations) {
  const path = join(__dirname, '..', 'supabase', 'migrations', file)
  const sql = readFileSync(path, 'utf8')
  console.log(`--- ${file} ---`)
  const ok = await runSql(sql)
  if (ok) console.log(`✓ ${file}`)
  else {
    console.log(`Copy ${path} into Supabase → SQL Editor → Run`)
  }
}
