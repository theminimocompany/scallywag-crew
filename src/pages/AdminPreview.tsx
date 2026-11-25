import { AdminHeader } from '@/components/chrome'
import { ClNotice } from '@/components/CrewlistUI'
import { segments, useHash } from '@/lib/hash'
import AdminRaces, { type AdminRacesPreview } from '@/pages/AdminRaces'
import AdminRaceDetail, { type AdminRaceDetailPreview } from '@/pages/AdminRaceDetail'
import AdminRoster, { type AdminRosterPreview } from '@/pages/AdminRoster'
import AdminImport, { type AdminImportPreview } from '@/pages/AdminImport'
import AdminSettings, { type AdminSettingsPreview } from '@/pages/AdminSettings'
import AdminAccessGate, { type AdminAccessPreview } from '@/pages/AdminAccessGate'
import { PREVIEW_RACE_ID, PREVIEW_TENANT_ID } from '@/pages/adminPreviewData'

const states = {
  races: ['default', 'loading', 'error', 'empty', 'add'],
  'race-detail': ['default', 'loading', 'error', 'edit', 'empty'],
  roster: ['default', 'loading', 'error', 'empty', 'add', 'detail', 'delete', 'pending'],
  import: ['default', 'loading', 'error', 'parsed', 'invalid', 'done'],
  settings: ['default', 'loading', 'error', 'invite', 'remove'],
  access: ['checking', 'denied', 'error'],
} as const

export default function AdminPreview() {
  const seg = segments(useHash())
  const requestedPage = seg[2] ?? 'races'
  const page = requestedPage in states ? requestedPage as keyof typeof states : 'races'
  const requestedState = seg[3] ?? 'default'
  const allowed = states[page] as readonly string[]
  const state = allowed.includes(requestedState) ? requestedState : allowed[0]

  if (page === 'access') {
    return (
      <AdminAccessGate
        key={`access-${state}`}
        tenantId={PREVIEW_TENANT_ID}
        userId="synthetic-preview-user"
        onSignOut={async () => {}}
        preview={state as AdminAccessPreview}
      >
        <></>
      </AdminAccessGate>
    )
  }

  return (
    <div className="cl-root cl-admin-app">
      <AdminHeader teamName="Testing101" previewBase="/mockups/admin" onSignOut={() => {}} />
      <div className="cl-container cl-admin-preview-notice">
        <ClNotice tone="info" title="Step 4 synthetic admin preview">Testing101 fixtures only. Auth, tenant data, invitations, imports, settings, clipboard and destructive writes are not called.</ClNotice>
      </div>
      {page === 'races' && <AdminRaces key={`races-${state}`} preview={state as AdminRacesPreview} />}
      {page === 'race-detail' && <AdminRaceDetail key={`race-${state}`} raceId={PREVIEW_RACE_ID} preview={state as AdminRaceDetailPreview} />}
      {page === 'roster' && <AdminRoster key={`roster-${state}`} preview={state as AdminRosterPreview} />}
      {page === 'import' && <AdminImport key={`import-${state}`} preview={state as AdminImportPreview} />}
      {page === 'settings' && <AdminSettings key={`settings-${state}`} preview={state as AdminSettingsPreview} />}
    </div>
  )
}
