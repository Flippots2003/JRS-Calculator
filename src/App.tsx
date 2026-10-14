import { customerLabel } from './domain/customers'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Calculator as CalculatorIcon, Check, CheckCircle2, CloudOff, FileText, Settings as SettingsIcon, ShieldCheck, UsersRound, WifiOff, X } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { calculate, saveErrors } from './domain/calculate'
import { defaultSettings, emptyDraft, type Customer, type Draft, type Quote, type Settings } from './domain/models'
import { db, loadSettings, loadWorkspace, saveCustomer, saveQuote, saveSettings, saveWorkspace, today } from './storage/database'
import { createBackup, downloadFile, downloadJson, readJson, restoreBackup, validateBackup, validatePriceList } from './storage/backup'
import { Calculator } from './pages/Calculator'
import { CustomersPage } from './pages/Customers'
import { QuotesPage } from './pages/Quotes'
import { SettingsPage } from './pages/Settings'
import { Notice } from './components/Fields'
import { PdfPreview } from './components/PdfPreview'
import { InstallHelp } from './offline/InstallHelp'

type Tab = 'calculator' | 'customers' | 'quotes' | 'settings'
const navigation = [{ id: 'calculator', label: 'Calculator', icon: CalculatorIcon }, { id: 'customers', label: 'Klanten', icon: UsersRound }, { id: 'quotes', label: 'Offertes', icon: FileText }, { id: 'settings', label: 'Instellingen', icon: SettingsIcon }] as const
export default function App() {
  const [tab, setTab] = useState<Tab>('calculator')
  const [settings, setSettings] = useState(defaultSettings)
  const [quoteSettings, setQuoteSettings] = useState(defaultSettings)
  const [draft, setDraft] = useState(emptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([]); const [quotes, setQuotes] = useState<Quote[]>([])
  const [loaded, setLoaded] = useState(false); const [initError, setInitError] = useState('')
  const [busy, setBusy] = useState(false); const busyRef = useRef(false)
  const [toast, setToast] = useState<{ text: string; error: boolean } | null>(null)
  const [autosaved, setAutosaved] = useState(false); const [storageError, setStorageError] = useState('')
  const [online, setOnline] = useState(navigator.onLine); const [persistent, setPersistent] = useState(false)
  const [lastBackup, setLastBackup] = useState<string | null>(null); const [settingsDirty, setSettingsDirty] = useState(false)
  const [pdf, setPdf] = useState<{ blob: Blob; filename: string } | null>(null)
  const [help, setHelp] = useState(false)
  const { offlineReady: [offlineReady], needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({ onRegisterError: () => setStorageError('Offlinebestanden konden niet worden bijgewerkt. Controleer je verbinding en heropen de app.') })
  const notify = useCallback((text: string, error = false) => setToast({ text, error }), [])
  const report = useCallback((error: unknown) => notify(error instanceof Error ? error.message : 'De actie is niet gelukt. Probeer opnieuw.', true), [notify])
  async function reload() {
    const [s, c, q, w, last] = await Promise.all([loadSettings(), db.customers.toArray(), db.quotes.toArray(), loadWorkspace(), db.meta.get('lastBackup')])
    setSettings(s); setCustomers(c.sort((a, b) => a.name.localeCompare(b.name, 'nl-BE'))); setQuotes(q.sort((a, b) => b.savedAt.localeCompare(a.savedAt)))
    setDraft(w?.draft ?? emptyDraft()); setQuoteSettings(w?.settings ?? s); setEditingId(w?.editingId ?? null); setLastBackup(typeof last?.value === 'string' ? last.value : null)
  }
  useEffect(() => {
    reload().then(() => setLoaded(true)).catch(e => setInitError(e instanceof Error ? e.message : 'De lokale database kon niet worden geopend.'))
    navigator.storage?.persisted?.().then(setPersistent).catch(() => {})
    const changed = () => setOnline(navigator.onLine)
    window.addEventListener('online', changed); window.addEventListener('offline', changed)
    return () => { window.removeEventListener('online', changed); window.removeEventListener('offline', changed) }
  }, [])
  const saveSequence = useRef(0)
  useEffect(() => {
    if (!loaded) return
    const sequence = ++saveSequence.current; setAutosaved(false)
    saveWorkspace({ draft, settings: quoteSettings, editingId }).then(() => { if (sequence === saveSequence.current) { setAutosaved(true); setStorageError('') } }).catch(() => setStorageError('Je concept kon niet bewaard worden. Controleer beschikbare opslagruimte en maak een back-up.'))
  }, [draft, quoteSettings, editingId, loaded])
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), toast.error ? 12000 : 5000); return () => clearTimeout(timer) }, [toast])
  async function run(action: () => Promise<void>) {
    if (busyRef.current) return
    busyRef.current = true; setBusy(true)
    try { await action() } catch (e) { report(e) } finally { busyRef.current = false; setBusy(false) }
  }
  function navigate(next: Tab) {
    if (settingsDirty && tab === 'settings' && next !== 'settings' && !window.confirm('Niet-opgeslagen instellingen weggooien?')) return
    if (next !== 'settings') setSettingsDirty(false)
    setTab(next)
  }
  function replaceDraft(next: Draft, snapshot: Settings, id: string | null) {
    const original = editingId ? quotes.find(q => q.id === editingId)?.draft : emptyDraft()
    const hasInput = JSON.stringify(draft) !== JSON.stringify(original)
    if (hasInput && !window.confirm('Je huidige invoer vervangen? Sla ze eerst op als je ze wilt behouden.')) return false
    setDraft(structuredClone(next)); setQuoteSettings(structuredClone(snapshot)); setEditingId(id); navigate('calculator'); window.scrollTo(0, 0); return true
  }
  function reset(customer?: Customer) { const next = emptyDraft(); if (customer) next.customer = structuredClone(customer); replaceDraft(next, settings, null) }
  async function save() {
    if (editingId && !window.confirm('De opgeslagen offerte bijwerken? De huidige opgeslagen versie blijft in de versiegeschiedenis bewaard.')) return
    await run(async () => { const q = await saveQuote(draft, quoteSettings, editingId); setDraft(q.draft); setEditingId(q.id); setQuotes((await db.quotes.toArray()).sort((a, b) => b.savedAt.localeCompare(a.savedAt))); setCustomers(await db.customers.toArray()); notify(`Offerte ${q.number} opgeslagen.`) })
  }
  async function customerSave(customer: Customer) {
    let success = false
    await run(async () => { await saveCustomer(customer); setCustomers(await db.customers.toArray()); notify('Klantgegevens opgeslagen.'); success = true })
    return success
  }
  async function calculatorCustomerSave() { await run(async () => { const c = await saveCustomer(draft.customer); setDraft(v => ({ ...v, customer: c })); setCustomers(await db.customers.toArray()); notify('Klantgegevens opgeslagen.') }) }
  async function updateSettings(next: Settings) {
    await run(async () => { await saveSettings(next); setSettings(next); if (!editingId) { setQuoteSettings(next); setDraft(v => ({ ...v, vatConfirmed: false, manualConfirmed: false })) }; setSettingsDirty(false); notify('Instellingen opgeslagen. Historische offertes blijven behouden.') })
  }
  async function displayPdf(quote: Quote, preview = true) {
    await run(async () => { const { generatePdf, pdfFilename } = await import('./pdf/generate'); const blob = generatePdf(quote); if (preview) setPdf({ blob, filename: pdfFilename(quote) }); else downloadFile(blob, pdfFilename(quote)) })
  }
  function previewCurrent() {
    const errors = saveErrors(draft, quoteSettings); if (errors.length) { notify(errors[0], true); return }
    const old = editingId ? quotes.find(q => q.id === editingId) : undefined
    const date = old?.date ?? today(); const validity = new Date(date + 'T12:00:00'); validity.setDate(validity.getDate() + quoteSettings.company.validityDays)
    const until = `${validity.getFullYear()}-${String(validity.getMonth() + 1).padStart(2, '0')}-${String(validity.getDate()).padStart(2, '0')}`
    void displayPdf({ id: editingId ?? 'preview', number: old?.number ?? 'JRS-CONCEPT', status: old?.status ?? 'Concept', date, validUntil: old?.validUntil ?? until, savedAt: new Date().toISOString(), draft, settings: quoteSettings, result: calculate(draft, quoteSettings), revisions: [] })
  }
  async function deleteQuote(q: Quote) { if (!window.confirm(`${q.number} en alle vorige versies definitief verwijderen?`)) return; await run(async () => { await db.quotes.delete(q.id); setQuotes(await db.quotes.toArray()); if (editingId === q.id) { setDraft(emptyDraft()); setQuoteSettings(settings); setEditingId(null) }; notify('Offerte verwijderd.') }) }
  async function deleteCustomer(c: Customer) { if (!window.confirm(`${customerLabel(c)} uit je klantenlijst verwijderen? De klantgegevens in bestaande offertes blijven behouden.`)) return; await run(async () => { await db.customers.delete(c.id); setCustomers(await db.customers.toArray()); if (draft.customer.id === c.id) setDraft(v => ({ ...v, customer: { ...v.customer, id: '' } })); notify('Klant verwijderd.') }) }
  async function exportBackup() { await run(async () => { await saveWorkspace({ draft, settings: quoteSettings, editingId }); const backup = await createBackup(); downloadJson(backup, `JRS-Backup-${today()}.json`); const at = new Date().toISOString(); await db.meta.put({ key: 'lastBackup', value: at }); setLastBackup(at); notify('Back-up geëxporteerd. Controleer of het bestand veilig is bewaard.') }) }
  async function importBackup(file: File) { await run(async () => { const backup = validateBackup(await readJson(file)); if (!window.confirm(`Deze back-up bevat ${backup.customers.length} klanten en ${backup.quotes.length} offertes. Alle huidige gegevens worden vervangen, ook je concept. Maak eerst een back-up. Herstellen?`)) return; await restoreBackup(backup); await reload(); setSettingsDirty(false); notify('Back-up volledig hersteld.') }) }
  async function importRates(file: File) { await run(async () => { const imported = validatePriceList(await readJson(file)); if (!window.confirm('Alle huidige tarieven en prijsregels vervangen? De bedrijfsgegevens en opgeslagen offertes blijven behouden.')) return; const next = { ...imported, company: settings.company }; await saveSettings(next); setSettings(next); if (!editingId) { setQuoteSettings(next); setDraft(v => ({ ...v, vatConfirmed: false, manualConfirmed: false })) }; setSettingsDirty(false); notify('Prijslijst geïmporteerd.') }) }
  async function requestPersistence() { try { const allowed = await navigator.storage?.persist?.(); setPersistent(Boolean(allowed)); notify(allowed ? 'Persistente opslag toegestaan.' : 'De browser heeft persistente opslag niet toegestaan. Bewaar regelmatig een back-up.') } catch (e) { report(e) } }
  if (initError) return <main className="loading"><h1>Lokale opslag niet beschikbaar</h1><Notice tone="warning">{initError}</Notice><p>Gebruik een gewone Chrome-tab met toegestane siteopslag. Wis geen gegevens als je nog geen back-up hebt.</p><button className="button primary" onClick={() => location.reload()}>Opnieuw proberen</button></main>
  if (!loaded) return <main className="loading"><span className="brand-mark">JRS</span><p>Je gegevens worden geopend…</p></main>
  const editingNumber = quotes.find(q => q.id === editingId)?.number
  return <div className="app-shell">
    <header className="app-header"><div className="brand"><span className="brand-mark" aria-hidden="true">JRS</span><div><strong>JRS Offertecalculator</strong><span>Jarne’s Ramenservice</span></div></div><div className="header-tools"><span className="connection"><span className={`status-dot ${online ? '' : 'off'}`} />{online ? 'Lokaal & privé' : 'Offline'}</span><button className="button secondary icon-button" aria-label="Installatiehulp openen" onClick={() => setHelp(!help)}><ShieldCheck size={19} /></button></div></header>
    <nav className="main-nav" aria-label="Hoofdnavigatie">{navigation.map(({ id, label, icon: Icon }) => <button key={id} aria-current={tab === id ? 'page' : undefined} className={tab === id ? 'current' : ''} onClick={() => navigate(id)}><Icon size={21} /><span>{label}</span>{tab === id && <span className="nav-dot" />}</button>)}</nav>
    <main className={`main-content ${tab === 'calculator' ? 'with-pricebar' : ''}`}>
      <div className="local-status"><span><CloudOff size={14} />{offlineReady ? 'Offline beschikbaar' : online ? 'Gegevens lokaal opgeslagen' : 'Zonder internetverbinding'}</span>{tab === 'calculator' && <span><Check size={14} />{autosaved ? 'Concept bewaard' : 'Concept bewaren…'}</span>}</div>
      {storageError && <Notice tone="warning">{storageError}</Notice>}
      {needRefresh && <Notice>Een nieuwe appversie is beschikbaar. Je gegevens blijven behouden.<button className="text-button" onClick={() => void run(async () => { if (settingsDirty) { notify('Sla eerst je instellingen op.', true); return }; await saveWorkspace({ draft, settings: quoteSettings, editingId }); await updateServiceWorker(true) })}>Update installeren</button></Notice>}
      {help && <InstallHelp />}
      {tab === 'calculator' && <Calculator key={editingId ?? 'new'} draft={draft} settings={quoteSettings} customers={customers} editingNumber={editingNumber} onChange={setDraft} onSave={() => void save()} onSaveCustomer={() => void calculatorCustomerSave()} onReset={() => reset()} onSettings={() => navigate('settings')} onPdf={previewCurrent} onRefreshRates={() => { if (window.confirm('Alle standaardtarieven en prijsregels voor deze offerte vervangen door je huidige instellingen? Afwijkende regelprijzen blijven behouden.')) { setQuoteSettings(structuredClone(settings)); setDraft(v => ({ ...v, manualConfirmed: false, vatConfirmed: false })) } }} busy={busy} />}
      {tab === 'customers' && <CustomersPage customers={customers} quotes={quotes} onSave={customerSave} onDelete={c => void deleteCustomer(c)} onQuote={reset} onOpenQuote={q => replaceDraft(q.draft, q.settings, q.id)} busy={busy} />}
      {tab === 'quotes' && <QuotesPage quotes={quotes} onNew={() => reset()} onEdit={q => replaceDraft(q.draft, q.settings, q.id)} onDuplicate={q => replaceDraft(q.draft, q.settings, null)} onDelete={q => void deleteQuote(q)} onPdf={(q, preview) => void displayPdf(q, Boolean(preview))} onStatus={(q, status) => void run(async () => { await db.quotes.update(q.id, { status }); setQuotes(await db.quotes.toArray()); notify('Status bijgewerkt.') })} onRevision={(q, index) => void displayPdf({ ...q, ...q.revisions[index] })} />}
      {tab === 'settings' && <SettingsPage settings={settings} onSave={updateSettings} onDirty={setSettingsDirty} onExportBackup={() => void exportBackup()} onImportBackup={f => void importBackup(f)} onExportRates={() => downloadJson({ app: 'JRS Prijslijst', schemaVersion: 1, settings: { ...settings, company: defaultSettings().company } }, `JRS-Prijslijst-${today()}.json`)} onImportRates={f => void importRates(f)} lastBackup={lastBackup} persistent={persistent} requestPersistence={() => void requestPersistence()} busy={busy} />}
      <footer className="app-footer"><ShieldCheck size={14} />Geen account. Geen cloud. Jouw gegevens op jouw toestel.</footer>
    </main>
    {toast && <div className={`toast ${toast.error ? 'error' : ''}`} role={toast.error ? 'alert' : 'status'}>{toast.error ? <WifiOff size={19} /> : <CheckCircle2 size={19} />}<span>{toast.text}</span><button aria-label="Melding sluiten" onClick={() => setToast(null)}><X size={17} /></button></div>}
    {pdf && <PdfPreview {...pdf} onClose={() => setPdf(null)} onError={report} />}
  </div>
}
