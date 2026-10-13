import { useEffect, useState } from 'react'
import { Building2, Download, RotateCcw, Save, Upload } from 'lucide-react'
import { accessOptions, catalog, difficultyOptions, frequencyOptions, groups } from '../domain/catalog'
import { settingsSchema, type Settings } from '../domain/models'
import { Field, Notice, NumberField, TextField } from '../components/Fields'
import { InstallHelp } from '../offline/InstallHelp'

interface Props {
  settings: Settings; onSave: (value: Settings) => Promise<void>; onDirty: (value: boolean) => void
  onExportBackup: () => void; onImportBackup: (file: File) => void
  onExportRates: () => void; onImportRates: (file: File) => void
  lastBackup: string | null; persistent: boolean; requestPersistence: () => void; busy: boolean
}
export function SettingsPage({ settings, onSave, onDirty, onExportBackup, onImportBackup, onExportRates, onImportRates, lastBackup, persistent, requestPersistence, busy }: Props) {
  const [value, setValue] = useState<Settings>(() => structuredClone(settings))
  const [tab, setTab] = useState('rates')
  const [error, setError] = useState('')
  const dirty = JSON.stringify(value) !== JSON.stringify(settings)
  useEffect(() => { onDirty(dirty) }, [dirty, onDirty])
  useEffect(() => { setValue(structuredClone(settings)) }, [settings])
  const set = <K extends keyof Settings>(key: K, next: Settings[K]) => setValue(v => ({ ...v, [key]: next }))
  const company = <K extends keyof Settings['company']>(key: K, next: Settings['company'][K]) => setValue(v => ({ ...v, company: { ...v.company, [key]: next } }))
  async function save() {
    const parsed = settingsSchema.safeParse(value)
    if (!parsed.success) { setError('Controleer je invoer: ' + parsed.error.issues[0].message); return }
    if (value.vatRegime === 'exempt' && !value.vatExplanation.trim()) { setError('Vul de toepasselijke vermelding voor de btw-vrijstelling in.'); return }
    setError(''); await onSave(parsed.data)
  }
  async function logo(file?: File) {
    if (!file) return
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 2_000_000) { setError('Kies een PNG- of JPEG-logo van maximaal 2 MB.'); return }
    try {
      const bitmap = await createImageBitmap(file); const canvas = document.createElement('canvas')
      const scale = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height)); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale)
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close()
      company('logo', canvas.toDataURL('image/png')); setError('')
    } catch { setError('Dit logo kan niet als afbeelding gelezen worden.') }
  }
  return <>
    <div className="page-heading"><div><p className="eyebrow">OP MAAT VAN JOUW BEDRIJF</p><h1>Instellingen</h1><p>Je tarieven, je regels, je gegevens.</p></div></div>
    <div className="tab-list" role="tablist" aria-label="Instellingsgroepen">{[['rates', 'Tarieven'], ['rules', 'Prijsregels'], ['company', 'Bedrijf'], ['data', 'Back-up & app']].map(([id, label], i, all) => <button key={id} role="tab" id={`tab-${id}`} aria-controls="settings-panel" aria-selected={tab === id} tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)} onKeyDown={e => { const index = e.key === 'ArrowRight' ? (i + 1) % all.length : e.key === 'ArrowLeft' ? (i + all.length - 1) % all.length : e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : null; if (index !== null) { e.preventDefault(); setTab(all[index][0]); document.getElementById(`tab-${all[index][0]}`)?.focus() } }}>{label}</button>)}</div>
    <div id="settings-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
    {error && <Notice tone="warning">{error}</Notice>}
    {tab === 'rates' && <>
      <Notice>Vul je eigen stukprijzen en werktijden in. Lege velden betekenen “niet ingesteld”; nul is een bewust ingesteld tarief. Bestaande offertes behouden hun oorspronkelijke prijzen.</Notice>
      <div className="card section"><div className="section-body"><Field label="Invoer van prijzen"><select value={value.priceBasis} onChange={e => { if (window.confirm('De ingevoerde bedragen blijven gelijk, maar hun btw-basis wijzigt. Controleer daarna alle tarieven en kosten. Doorgaan?')) set('priceBasis', e.target.value as Settings['priceBasis']) }}><option value="inclusive">Inclusief btw (standaard)</option><option value="exclusive">Exclusief btw</option></select></Field></div></div>
      {groups.map(group => <section className="card section" key={group.id}><div className="section-header"><h2>{group.name}</h2></div><div className="section-body rate-list">{catalog.filter(c => c.group === group.id).map(c => <div key={c.id} className="rate-row"><strong>{c.name}</strong><div className="rate-inputs"><NumberField label={`Prijs ${c.name} ${group.short}`} value={value.rates[c.id].priceCents} nullable onChange={p => set('rates', { ...value.rates, [c.id]: { ...value.rates[c.id], priceCents: p } })} suffix="€" /><NumberField label={`Werktijd ${c.name} ${group.short}`} value={value.rates[c.id].minutes} decimals={0} max={100000} nullable onChange={m => set('rates', { ...value.rates, [c.id]: { ...value.rates[c.id], minutes: m } })} suffix="min" /><button className="icon-button button secondary" aria-label={`Tarief ${c.name} ${group.short} herstellen naar laatst opgeslagen waarde`} onClick={() => set('rates', { ...value.rates, [c.id]: structuredClone(settings.rates[c.id]) })}><RotateCcw size={16} /></button></div></div>)}</div></section>)}
      <section className="card section"><div className="section-body"><h2>Prijslijst meenemen</h2><p>Exporteert de opgeslagen tarieven en prijsregels, zonder klanten of offertes.</p><div className="actions"><button className="button secondary" disabled={dirty} onClick={onExportRates}><Download size={17} />Prijslijst exporteren</button><label className="button secondary file-button"><Upload size={17} />Prijslijst importeren<input type="file" accept=".json,application/json" onChange={e => { const f = e.target.files?.[0]; if (f) onImportRates(f); e.target.value = '' }} /></label></div>{dirty && <p className="micro">Sla je aanpassingen eerst op om ze te exporteren.</p>}</div></section>
    </>}
    {tab === 'rules' && <>
      <section className="card section"><div className="section-header"><h2>Arbeid en minimumprijzen</h2></div><div className="section-body form-grid"><NumberField label="Minimaal uurtarief incl. btw" value={value.minimumHourlyCents} onChange={v => set('minimumHourlyCents', v ?? 0)} suffix="€/u" /><NumberField label="Minimumopdracht incl. btw" value={value.minimumOrderCents} onChange={v => set('minimumOrderCents', v ?? 0)} suffix="€" /><NumberField label="Vaste voorbereidingstijd" value={value.preparationMinutes} decimals={0} max={100000} onChange={v => set('preparationMinutes', v ?? 0)} suffix="min" /></div></section>
      {([['Moeilijkheidsgraad', difficultyOptions, 'difficultyBps'], ['Bereikbaarheid', accessOptions, 'accessBps'], ['Frequentiekortingen', frequencyOptions, 'frequencyBps']] as const).map(([title, options, key]) => <section className="card section" key={key}><div className="section-header"><h2>{title}</h2></div><div className="section-body form-grid">{options.map((name, i) => <NumberField key={name} label={name} value={value[key][i]} max={10000} onChange={v => set(key, value[key].map((p, j) => i === j ? (v ?? 0) : p))} suffix="%" />)}</div></section>)}
      <section className="card section"><div className="section-header"><h2>Verplaatsing</h2></div><div className="section-body form-grid"><div className="span-2"><TextField label="Vertrekgemeente / vestigingsadres" value={value.travel.origin} onChange={v => set('travel', { ...value.travel, origin: v })} /></div><NumberField label="Gratis straal" value={value.travel.freeRadiusDeciKm} decimals={1} max={100000} onChange={v => set('travel', { ...value.travel, freeRadiusDeciKm: v ?? 0 })} suffix="km" /><NumberField label={`Bedrag per extra km ${value.priceBasis === 'inclusive' ? 'incl.' : 'excl.'} btw`} value={value.travel.perKmCents} onChange={v => set('travel', { ...value.travel, perKmCents: v ?? 0 })} suffix="€" /><label className="check span-2"><input type="checkbox" checked={value.travel.returnTrip} onChange={e => set('travel', { ...value.travel, returnTrip: e.target.checked })} />Terugrit meerekenen</label></div></section>
      <section className="card section"><div className="section-header"><h2>Btw</h2></div><div className="section-body form-grid"><Field label="Btw-regime"><select value={value.vatRegime} onChange={e => { if (e.target.value === 'normal' || window.confirm('Bevestig dat een btw-vrijstelling juridisch van toepassing is op je onderneming en deze diensten.')) set('vatRegime', e.target.value as Settings['vatRegime']) }}><option value="normal">Normale regeling</option><option value="exempt">Btw-vrijstelling</option></select></Field><NumberField label="Btw-tarief normale regeling" value={value.vatBps} max={10000} onChange={v => set('vatBps', v ?? 0)} suffix="%" /><div className="span-2"><TextField label="Vermelding afwijkend btw-regime" value={value.vatExplanation} onChange={v => set('vatExplanation', v)} /></div><div className="span-2"><Notice tone="warning">Standaard geldt 21%. Een ouder gebouw geeft geen automatische toepassing van 6% op ramenwas. Een afwijking moet per offerte bevestigd worden. Deze app vervangt geen fiscaal advies.</Notice></div></div></section>
    </>}
    {tab === 'company' && <section className="card section"><div className="section-header"><Building2 size={20} /><h2>Bedrijfsgegevens</h2></div><div className="section-body"><Notice>De kleuren en het app-icoon zijn tijdelijk en neutraal. Voeg je eigen logo en juiste bedrijfsgegevens toe voor klantklare PDF’s.</Notice><div className="logo-editor">{value.company.logo && <img src={value.company.logo} alt="Bedrijfslogo" />}<label className="button secondary file-button"><Upload size={17} />Logo uploaden<input type="file" accept="image/png,image/jpeg" onChange={e => { void logo(e.target.files?.[0]); e.target.value = '' }} /></label>{value.company.logo && <button className="text-button" onClick={() => company('logo', '')}>Logo verwijderen</button>}</div><div className="form-grid">
      <div className="span-2"><TextField label="Bedrijfsnaam" value={value.company.name} onChange={v => company('name', v)} /></div>
      <div className="span-2"><Field label="Bedrijfsadres"><textarea value={value.company.address} onChange={e => company('address', e.target.value)} rows={2} /></Field></div>
      {([['phone', 'Telefoonnummer'], ['email', 'E-mailadres'], ['enterpriseNumber', 'Ondernemingsnummer'], ['vatNumber', 'Btw-nummer'], ['website', 'Website'], ['payment', 'Bank- en betalingsgegevens']] as const).map(([key, label]) => <TextField key={key} label={label} value={value.company[key]} onChange={v => company(key, v)} type={key === 'email' ? 'email' : 'text'} />)}
      <NumberField label="Geldigheidsduur offerte" value={value.company.validityDays} decimals={0} max={365} onChange={v => company('validityDays', Math.max(1, v ?? 1))} suffix="dagen" />
      <div className="span-2"><Field label="Standaardoffertetekst"><textarea rows={4} value={value.company.quoteText} onChange={e => company('quoteText', e.target.value)} /></Field></div>
      <div className="span-2"><Field label="Algemene voorwaarden"><textarea rows={5} value={value.company.terms} onChange={e => company('terms', e.target.value)} /></Field></div>
    </div></div></section>}
    {tab === 'data' && <>
      <section className="card section"><div className="section-header"><h2>Back-up en herstel</h2></div><div className="section-body"><p>Bewaar een kopie buiten deze app. Een back-up bevat klanten, offertes, vorige versies, je huidige concept en instellingen.</p><Notice tone="warning">Deze bestanden bevatten vertrouwelijke klantgegevens. Bewaar ze op een veilige plaats. Sitegegevens wissen of de app verwijderen kan lokale gegevens doen verdwijnen.</Notice><p className="backup-date">Laatste export: <strong>{lastBackup ? new Date(lastBackup).toLocaleString('nl-BE') : 'Nog geen back-up gemaakt'}</strong></p><div className="actions"><button className="button primary" disabled={busy} onClick={onExportBackup}><Download size={17} />Volledige back-up exporteren</button><label className="button secondary file-button"><Upload size={17} />Back-up herstellen<input type="file" accept=".json,application/json" disabled={busy} onChange={e => { const f = e.target.files?.[0]; if (f) onImportBackup(f); e.target.value = '' }} /></label></div></div></section>
      <section className="card section"><div className="section-header"><h2>Opslag op dit toestel</h2></div><div className="section-body"><p>{persistent ? 'De browser heeft persistente opslag toegestaan.' : 'Vraag de browser om je gegevens minder snel automatisch op te ruimen.'}</p><button className="button secondary" onClick={requestPersistence} disabled={persistent}>Persistente opslag aanvragen</button><p className="micro">Ook persistente opslag beschermt niet tegen het bewust wissen van sitegegevens. Blijf back-ups maken.</p></div></section>
      <InstallHelp />
    </>}
    {tab !== 'data' && <div className="settings-save"><span>{dirty ? 'Niet-opgeslagen wijzigingen' : 'Alles is opgeslagen'}</span><button className="button primary" onClick={() => void save()} disabled={!dirty || busy}><Save size={18} />{busy ? 'Bezig…' : 'Instellingen opslaan'}</button></div>}
    </div>
  </>
}
