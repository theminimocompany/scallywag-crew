// Nightly backup: Supabase -> Google Sheets
// Tabs: Races (Airtable-style view), Crew (full roster), Signups (raw rows).
// All secrets come from environment variables — nothing sensitive in this file.

import { google } from 'googleapis'

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GOOGLE_SERVICE_ACCOUNT_JSON', 'SHEET_ID']
for (const k of REQUIRED) {
  if (!process.env[k]) {
    console.error(`Missing environment variable: ${k}`)
    process.exit(1)
  }
}
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SHEET_ID } = process.env
const TENANT_SLUG = 'scallywag'

// ---------- Supabase ----------
const sbHeaders = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
}
async function sb(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders })
  if (!res.ok) throw new Error(`Supabase ${path}: ${res.status} ${await res.text()}`)
  return res.json()
}

const tenants = await sb(`tenants?slug=eq.${TENANT_SLUG}&select=id,name`)
if (tenants.length !== 1) throw new Error(`Tenant '${TENANT_SLUG}' not found`)
const tenant = tenants[0]
console.log(`Tenant: ${tenant.name} (${tenant.id})`)

const [races, crew, allSignups] = await Promise.all([
  sb(`races?tenant_id=eq.${tenant.id}&order=race_date&select=id,name,race_date,is_hidden,signup_closed`),
  sb(`crew?tenant_id=eq.${tenant.id}&order=name&select=id,name,phone,emergency_contact_name,emergency_contact_phone,notes,is_approved`),
  sb(`signups?select=race_id,status,crew(name),races(name,race_date)`),
])
const raceIds = new Set(races.map(r => r.id))
const signups = allSignups.filter(s => raceIds.has(s.race_id))
console.log(`Rows: ${races.length} races, ${crew.length} crew, ${signups.length} signups`)

// ---------- Build tab contents ----------
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const fmtDate = iso => {
  const d = new Date(iso + 'T00:00:00')
  return `${iso} (${DOW[d.getDay()]})`
}
const names = rows => rows.map(s => s.crew?.name).filter(Boolean).sort().join('\n')

const racesRows = [
  ['Race Date', 'Race Name', 'Available #', 'Selected #', 'Available Crew', 'Selected Crew', 'Sign-ups', 'Visible'],
  ...races.map(r => {
    const su = signups.filter(s => s.race_id === r.id)
    const avail = su.filter(s => s.status === 'available')
    const sel = su.filter(s => s.status === 'selected')
    return [
      fmtDate(r.race_date),
      r.name,
      avail.length,
      sel.length,
      names(avail),
      names(sel),
      r.signup_closed ? 'Closed' : 'Open',
      r.is_hidden ? 'Hidden' : 'Visible',
    ]
  }),
]

const crewRows = [
  ['Name', 'Phone', 'Emergency Contact', 'Emergency Phone', 'Approved', 'Notes'],
  ...crew.map(c => [
    c.name,
    c.phone ?? '',
    c.emergency_contact_name ?? '',
    c.emergency_contact_phone ?? '',
    c.is_approved ? 'Yes' : 'Pending',
    c.notes ?? '',
  ]),
]

const signupRows = [
  ['Race Date', 'Race Name', 'Crew', 'Status'],
  ...signups
    .map(s => [s.races?.race_date ?? '', s.races?.name ?? '', s.crew?.name ?? '', s.status])
    .sort((a, b) => a[0].localeCompare(b[0]) || a[2].localeCompare(b[2])),
]

// ---------- Google Sheets ----------
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
})
const sheets = google.sheets({ version: 'v4', auth })

// Make sure all three tabs exist
const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID })
const existing = new Set(meta.data.sheets.map(s => s.properties.title))
const missing = ['Races', 'Crew', 'Signups'].filter(t => !existing.has(t))
if (missing.length > 0) {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: { requests: missing.map(title => ({ addSheet: { properties: { title } } })) },
  })
  console.log(`Created tabs: ${missing.join(', ')}`)
}

// Rewrite each tab from scratch
for (const [title, rows] of [['Races', racesRows], ['Crew', crewRows], ['Signups', signupRows]]) {
  await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: `'${title}'` })
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `'${title}'!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  })
}

// Light formatting: frozen bold header row on each tab
const meta2 = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID })
const fmtRequests = []
for (const s of meta2.data.sheets) {
  if (!['Races', 'Crew', 'Signups'].includes(s.properties.title)) continue
  const sheetId = s.properties.sheetId
  fmtRequests.push(
    { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: { userEnteredFormat: { textFormat: { bold: true } } },
        fields: 'userEnteredFormat.textFormat.bold',
      },
    },
  )
}
if (fmtRequests.length > 0) {
  await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { requests: fmtRequests } })
}

console.log(`Backup complete: ${racesRows.length - 1} races, ${crewRows.length - 1} crew, ${signupRows.length - 1} signups written.`)
