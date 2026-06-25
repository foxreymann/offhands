import { loadEnv } from '../libs/env.js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

loadEnv()

const __dirname = dirname(fileURLToPath(import.meta.url))
const ref = process.env.SUPABASE_URL?.match(/https:\/\/([^.]+)/)?.[1]
const password = process.env.SUPABASE_DB_PASSWORD
const region = process.env.SUPABASE_DB_REGION || 'eu-west-1'

if (!ref || !password) {
  console.error('Set SUPABASE_URL and SUPABASE_DB_PASSWORD in .env')
  console.error('Database password: Supabase Dashboard → Project Settings → Database')
  process.exit(1)
}

const conn = `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-${region}.pooler.supabase.com:6543/postgres`

const files = ['001_schema.sql', '002_whatsapp.sql']

for (const file of files) {
  const path = join(__dirname, '..', 'supabase', 'migrations', file)
  const sql = readFileSync(path, 'utf8')
  console.log(`Applying ${file}...`)
  const result = spawnSync('psql', [conn, '-v', 'ON_ERROR_STOP=1', '-f', path], {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout)
    console.error(`Failed on ${file}`)
    process.exit(1)
  }
  console.log(`✓ ${file}`)
}

console.log('\nSchema applied. Testing REST API...')
const key = process.env.SUPABASE_SECRET_KEY
const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/business_state?id=eq.1&select=*`, {
  headers: { apikey: key },
})
const data = await res.json()
console.log('business_state:', JSON.stringify(data, null, 2))
