import type { AdminInfo, Crew, CsvRace, InviteInfo, Race, Signup, Tenant } from '@/lib/api'

export const PREVIEW_TENANT_ID = '11111111-1111-4111-8111-111111111111'
export const PREVIEW_RACE_ID = '22222222-2222-4222-8222-222222222222'
export const PREVIEW_INVITE_TOKEN = '33333333-3333-4333-8333-333333333333'

export const previewTenant: Tenant = {
  id: PREVIEW_TENANT_ID,
  slug: 'testing101',
  name: 'Testing101',
  status: 'active',
}

export const previewRaces: Race[] = [
  { id: PREVIEW_RACE_ID, tenant_id: PREVIEW_TENANT_ID, name: 'Ruffian Winter Series — Race 4', race_date: '2026-12-05', start_time: '13:45', location: 'Victoria Harbour', is_hidden: false, signup_closed: false },
  { id: '44444444-4444-4444-8444-444444444444', tenant_id: PREVIEW_TENANT_ID, name: 'Saturday Harbour Race', race_date: '2026-12-12', start_time: '10:30', location: 'Causeway Bay', is_hidden: false, signup_closed: true },
  { id: '55555555-5555-4555-8555-555555555555', tenant_id: PREVIEW_TENANT_ID, name: 'Christmas Pursuit Race', race_date: '2026-12-19', start_time: '', location: 'Royal Hong Kong Yacht Club', is_hidden: true, signup_closed: false },
  { id: '66666666-6666-4666-8666-666666666666', tenant_id: PREVIEW_TENANT_ID, name: 'Autumn Series — Final', race_date: '2026-11-15', start_time: '14:00', location: 'Victoria Harbour', is_hidden: false, signup_closed: false },
]

export const previewCrew: Crew[] = [
  { id: '77777777-7777-4777-8777-777777777771', tenant_id: PREVIEW_TENANT_ID, airtable_id: null, name: 'Alex Chan', given_name: null, family_name: null, phone: '+852 5555 0101', emergency_contact_name: 'Jamie Chan', emergency_contact_phone: '+852 5555 0199', notes: null, is_approved: true, created_at: '2026-10-01T00:00:00Z' },
  { id: '77777777-7777-4777-8777-777777777772', tenant_id: PREVIEW_TENANT_ID, airtable_id: null, name: 'Chris Wong', given_name: null, family_name: null, phone: '+852 5555 0102', emergency_contact_name: null, emergency_contact_phone: null, notes: null, is_approved: true, created_at: '2026-10-02T00:00:00Z' },
  { id: '77777777-7777-4777-8777-777777777773', tenant_id: PREVIEW_TENANT_ID, airtable_id: null, name: 'Morgan Lee', given_name: null, family_name: null, phone: '+852 5555 0103', emergency_contact_name: null, emergency_contact_phone: null, notes: null, is_approved: true, created_at: '2026-10-03T00:00:00Z' },
  { id: '77777777-7777-4777-8777-777777777774', tenant_id: PREVIEW_TENANT_ID, airtable_id: null, name: 'Taylor Ng', given_name: null, family_name: null, phone: null, emergency_contact_name: null, emergency_contact_phone: null, notes: null, is_approved: false, created_at: '2026-11-20T00:00:00Z' },
  { id: '77777777-7777-4777-8777-777777777775', tenant_id: PREVIEW_TENANT_ID, airtable_id: null, name: 'Jordan Lam', given_name: null, family_name: null, phone: '+852 5555 0105', emergency_contact_name: null, emergency_contact_phone: null, notes: null, is_approved: true, created_at: '2026-10-05T00:00:00Z' },
]

export const previewSignups: Signup[] = [
  { id: '88888888-8888-4888-8888-888888888881', tenant_id: PREVIEW_TENANT_ID, race_id: PREVIEW_RACE_ID, crew_id: previewCrew[0].id, status: 'selected', source: 'admin', created_at: '2026-11-01T00:00:00Z' },
  { id: '88888888-8888-4888-8888-888888888882', tenant_id: PREVIEW_TENANT_ID, race_id: PREVIEW_RACE_ID, crew_id: previewCrew[1].id, status: 'available', source: 'form', created_at: '2026-11-02T00:00:00Z' },
  { id: '88888888-8888-4888-8888-888888888883', tenant_id: PREVIEW_TENANT_ID, race_id: PREVIEW_RACE_ID, crew_id: previewCrew[2].id, status: 'selected', source: 'form', created_at: '2026-11-03T00:00:00Z' },
  { id: '88888888-8888-4888-8888-888888888884', tenant_id: PREVIEW_TENANT_ID, race_id: previewRaces[1].id, crew_id: previewCrew[0].id, status: 'available', source: 'form', created_at: '2026-11-04T00:00:00Z' },
]

export const previewRaceRows = previewSignups
  .filter(row => row.race_id === PREVIEW_RACE_ID)
  .map(row => ({
    ...row,
    crew: {
      id: row.crew_id,
      name: previewCrew.find(person => person.id === row.crew_id)?.name ?? 'Synthetic crew',
      is_approved: previewCrew.find(person => person.id === row.crew_id)?.is_approved ?? true,
    },
  }))

export const previewHistory = previewSignups.map(row => ({
  ...row,
  races: {
    id: row.race_id,
    name: previewRaces.find(race => race.id === row.race_id)?.name ?? 'Synthetic race',
    race_date: previewRaces.find(race => race.id === row.race_id)?.race_date ?? '2026-12-05',
  },
}))

export const previewCsvRows: CsvRace[] = [
  { name: 'Ruffian Winter Series — Race 5', date: '2027-01-09', startTime: '13:45', location: 'Victoria Harbour', duplicate: false, include: true },
  { name: 'Ruffian Winter Series — Race 6', date: '2027-01-16', startTime: '13:45', location: 'Victoria Harbour', duplicate: false, include: true },
  { name: 'Ruffian Winter Series — Race 4', date: '2026-12-05', startTime: '13:45', location: 'Victoria Harbour', duplicate: true, include: false },
  { name: 'Race Management Duty', date: '2027-01-23', startTime: '08:30', location: 'RHKYC', duplicate: false, include: false },
]

export const previewAdmins: AdminInfo[] = [
  { email: 'owner@testing101.invalid', is_you: true },
  { email: 'co.admin@testing101.invalid', is_you: false },
]

export const previewInvites: InviteInfo[] = [
  { id: '99999999-9999-4999-8999-999999999999', email: 'pending@testing101.invalid', status: 'pending', expires_at: '2026-12-02T00:00:00Z', created_at: '2026-11-25T00:00:00Z' },
]
