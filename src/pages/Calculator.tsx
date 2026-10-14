import { windowCounts, resizeWindow, assignWindowDifficulty } from '../domain/window-difficulty'
import { customerLabel } from '../domain/customers'
import { useMemo, useState } from 'react'
import { ArrowUpRight, ChevronDown, FileText, Minus, Plus, RotateCcw, Save, SlidersHorizontal, Sparkles, UserRound } from 'lucide-react'
import { accessOptions, catalog, difficultyOptions, frequencyOptions, currentGroups as groups, type GroupId } from '../domain/catalog'
import { calculate, overlapRisk, saveErrors } from '../domain/calculate'
import type { Customer, Draft, QuoteLine, Settings } from '../domain/models'
import { duration, money } from '../domain/money'
import { CustomerForm } from '../components/CustomerForm'
import { Field, Notice, NumberField } from '../components/Fields'
import { PriceSummary } from '../components/PriceSummary'

interface Props {
  draft: Draft; settings: Settings; customers: Customer[]; editingNumber?: string
  onChange: (draft: Draft) => void; onSave: () => void; onSaveCustomer: () => void
  onReset: () => void; onSettings: () => void; onPdf: () => void; onRefreshRates: () => void
  busy: boolean
}
export function Calculator({ draft, settings, customers, editingNumber, onChange, onSave, onSaveCustomer, onReset, onSettings, onPdf, onRefreshRates, busy }: Props) {
  const r = useMemo(() => calculate(draft, settings), [draft, settings])
  const errors = saveErrors(draft, settings)
  const [expanded, setExpanded] = useState<Set<GroupId>>(() => new Set(['windows-outside', ...draft.lines.filter(l => l.quantity).map(l => catalog.find(c => c.id === l.id)!.group)]))
  const [showErrors, setShowErrors] = useState(false)
  const set = <K extends keyof Draft>(key: K, next: Draft[K]) => onChange({ ...draft, [key]: next, ...(key !== 'manualConfirmed' && key !== 'customer' && key !== 'notes' ? { manualConfirmed: false } : {}) })
  function setLine(id: string, change: Partial<QuoteLine>) {
    set('lines', draft.lines.map(line => {
      if (line.id !== id) return line
      const next = { ...line, ...change }
      return id.startsWith('windows-outside-') && change.quantity !== undefined && change.difficultyCounts === undefined
        ? { ...resizeWindow(line, change.quantity, draft.difficulty), ...change } : next
    }))
  }
  function toggleGroup(group: GroupId) {
    const next = new Set(expanded)
    if (next.has(group)) {
      const active = draft.lines.some(l => catalog.find(c => c.id === l.id)!.group === group && l.quantity > 0)
      if (active && !window.confirm('Deze dienst en de ingevoerde aantallen verwijderen?')) return
      next.delete(group)
      set('lines', draft.lines.map(l => catalog.find(c => c.id === l.id)!.group === group ? { ...l, quantity: 0, ...(l.difficultyCounts ? { difficultyCounts: [0, 0, 0, 0] as [number, number, number, number] } : {}) } : l))
    } else next.add(group)
    setExpanded(next)
  }
  const allMissing = Object.values(settings.rates).every(rate => rate.priceCents === null)
  return <>
    <div className="page-heading"><div><p className="eyebrow">VAN KLANTBEZOEK TOT OFFERTE</p><h1>{editingNumber ?? 'Nieuwe offerte'}</h1><p>Een heldere prijs, tot op de cent.</p></div><button className="button secondary icon-button" onClick={onReset} title="Nieuwe offerte starten"><RotateCcw size={18} /><span>Opnieuw</span></button></div>
    <Notice><strong>Ingevulde richtprijzen, excl. btw</strong><p>Arbeidsnorm {money(settings.minimumHourlyCents)}/u en minimumopdracht {money(settings.minimumOrderCents)}. Stukprijzen en tijden zijn startschattingen; pas uitzonderlijk werk aan.</p></Notice>
    {allMissing && <Notice><div className="notice-line"><Sparkles size={20} /><div><strong>Welkom bij je offertecalculator</strong><p>De standaardrichtprijzen zijn ingevuld. Je kunt alle tarieven en werktijden aanpassen.</p><button className="text-button" onClick={onSettings}>Prijslijst instellen <ArrowUpRight size={16} /></button></div></div></Notice>}
    {editingNumber && <Notice>Je bewerkt een opgeslagen offerte. De huidige rekenregels gelden voor wijzigingen; de oorspronkelijke opgeslagen versie blijft bewaard.<button className="text-button" onClick={onRefreshRates}>Actuele tarieven gebruiken</button></Notice>}
    <div className="calculator-grid"><div className="calculator-input">
      <details className="card section" open><summary><span className="section-icon"><UserRound size={19} /></span><div><h2>Klantgegevens</h2><p>{draft.customer.name || 'Voor wie maken we de offerte?'}</p></div><ChevronDown className="chevron" size={18} /></summary><div className="section-body">
        {customers.length > 0 && <Field label="Bestaande klant selecteren"><select value={draft.customer.id} onChange={e => { const c = customers.find(c => c.id === e.target.value); if (c) set('customer', structuredClone(c)); else set('customer', { ...draft.customer, id: '' }) }}><option value="">Nieuwe klant</option>{customers.map(c => <option key={c.id} value={c.id}>{customerLabel(c)}</option>)}</select></Field>}
        <CustomerForm value={draft.customer} onChange={v => set('customer', v)} />
        <button className="button secondary" onClick={onSaveCustomer} disabled={busy}><UserRound size={16} />{draft.customer.id ? 'Klantgegevens bijwerken' : 'Klant afzonderlijk opslaan'}</button>
      </div></details>
      <section className="card section"><div className="section-header"><span className="section-icon"><Sparkles size={19} /></span><div><h2>Diensten</h2><p>Tel per volledig onderdeel, inclusief kader.</p></div><span className="badge">{r.quantity} stuks</span></div>
        <div className="section-body"><div className="service-picker">{groups.map(group => <button key={group.id} className={`service-chip ${expanded.has(group.id) ? 'selected' : ''}`} onClick={() => toggleGroup(group.id)} aria-pressed={expanded.has(group.id)}>{expanded.has(group.id) ? <Minus size={15} /> : <Plus size={15} />}{group.short}</button>)}</div>
        {groups.filter(group => expanded.has(group.id)).map(group => <div className="service-group" key={group.id}><div className="service-group-title"><h3>{group.name}</h3><p>{group.description}</p></div>{catalog.filter(item => item.group === group.id).map(item => {
          const line = draft.lines.find(l => l.id === item.id) ?? { id: item.id, quantity: 0, overridePriceCents: null, overrideMinutes: null, note: '' }
          const counts = windowCounts(line, draft.difficulty)
          const price = line.overridePriceCents ?? settings.rates[item.id].priceCents
          const minutes = line.overrideMinutes ?? settings.rates[item.id].minutes
          return <div className={`service-line ${line.quantity ? 'active' : ''}`} key={item.id}>
            <div className="line-main"><div className="line-label"><strong>{item.name}</strong><small>{price === null ? <span className="missing">Prijs nog niet ingesteld</span> : `${money(price)} / stuk`}{minutes !== null ? ` · ${minutes} min` : ' · tijd ontbreekt'}</small></div><div className="stepper"><button aria-label={`${item.name} ${group.short} verminderen`} onClick={() => setLine(item.id, { quantity: Math.max(0, line.quantity - 1) })} disabled={line.quantity === 0}><Minus size={17} /></button><input aria-label={`Aantal ${item.name} ${group.short}`} type="number" inputMode="numeric" min="0" max="20000" value={line.quantity} onChange={e => { const v = Number(e.target.value); if (Number.isInteger(v) && v >= 0 && v <= 20000) setLine(item.id, { quantity: v }) }} /><button aria-label={`${item.name} ${group.short} toevoegen`} onClick={() => setLine(item.id, { quantity: Math.min(20000, line.quantity + 1) })}><Plus size={17} /></button></div></div>
            {item.group === 'windows-outside' && <div className="window-difficulty"><p className="micro">Moeilijkheid verdelen · totaal {line.quantity} ramen. Nieuwe ramen tellen als normaal.</p><div className="difficulty-grid">{difficultyOptions.map((label, i) => <NumberField key={label} label={label} ariaLabel={`${label} — ${item.name}`} value={counts[i]} decimals={0} max={i === 0 ? 20000 - counts.slice(1).reduce((sum, n) => sum + n, 0) : counts[0] + counts[i]} onChange={v => setLine(item.id, assignWindowDifficulty(line, i, v ?? 0, draft.difficulty))} hint={`+${settings.difficultyBps[i] / 100}%${i === 0 ? ' · past totaal aan' : ''}`} />)}</div></div>}
            <details className="line-options"><summary>Aangepaste prijs, tijd of opmerking <ChevronDown size={13} /></summary><div className="form-grid"><NumberField label={`Eigen stukprijs ${item.name}`} value={line.overridePriceCents} nullable onChange={v => setLine(item.id, { overridePriceCents: v })} suffix="€" hint="Leeg = standaardtarief" /><NumberField label={`Eigen werktijd ${item.name}`} value={line.overrideMinutes} decimals={0} max={100000} nullable onChange={v => setLine(item.id, { overrideMinutes: v })} suffix="min" hint="Leeg = standaardtijd" /><div className="span-2"><Field label={`Opmerking ${item.name}`}><input value={line.note} onChange={e => setLine(item.id, { note: e.target.value })} /></Field></div></div></details>
          </div>
        })}</div>)}
        {overlapRisk(draft) && <Notice tone="warning"><strong>Controleer op dubbeltelling</strong><p>Glas dat inbegrepen is in een veranda of tuinhuis mag niet opnieuw als afzonderlijk raam aangerekend worden.</p><label className="check"><input type="checkbox" checked={draft.overlapConfirmed} onChange={e => set('overlapConfirmed', e.target.checked)} />Ik bevestig dat dit verschillende onderdelen zijn.</label></Notice>}
        </div>
      </section>
      <details className="card section" open><summary><span className="section-icon"><SlidersHorizontal size={19} /></span><div><h2>Aanpassingen</h2><p>Werkhoogte, frequentie en bijkomende kosten.</p></div><ChevronDown className="chevron" size={18} /></summary><div className="section-body">
        <p className="micro">Bedragen hieronder zijn exclusief btw. Ook de handmatige eindprijs is exclusief btw.</p>
        <div className="form-grid">
          <Field label="Moeilijkheidsgraad overige diensten" hint="Ramen gebruiken hun eigen verdeling. Voor oudere ramen zonder verdeling geldt deze keuze totdat je ze aanpast."><select value={draft.difficulty} onChange={e => set('difficulty', Number(e.target.value))}>{difficultyOptions.map((s, i) => <option key={s} value={i}>{s} · {settings.difficultyBps[i] / 100}%</option>)}</select></Field>
          <Field label="Bereikbaarheid"><select value={draft.access} onChange={e => set('access', Number(e.target.value))}>{accessOptions.map((s, i) => <option key={s} value={i}>{s} · {settings.accessBps[i] / 100}%</option>)}</select></Field>
          <div className="span-2"><Field label="Frequentie"><select value={draft.frequency} onChange={e => set('frequency', Number(e.target.value))}>{frequencyOptions.map((s, i) => <option key={s} value={i}>{s} · {settings.frequencyBps[i] / 100}% korting</option>)}</select></Field></div>
          <Field label="Extra korting"><select value={draft.discountType} onChange={e => onChange({ ...draft, discountType: e.target.value as Draft['discountType'], discountValue: 0, manualConfirmed: false })}><option value="percent">Percentage</option><option value="fixed">Vast bedrag</option></select></Field>
          <NumberField label="Kortingswaarde" value={draft.discountValue} max={draft.discountType === 'percent' ? 10000 : undefined} onChange={v => set('discountValue', v ?? 0)} suffix={draft.discountType === 'percent' ? '%' : '€'} />
          <NumberField label="Interne materiaalkost" value={draft.internalMaterialCents} onChange={v => set('internalMaterialCents', v ?? 0)} suffix="€" hint="Alleen intern, nooit automatisch op de offerte" />
          <NumberField label="Materiaal voor klant" value={draft.materialCents} onChange={v => set('materialCents', v ?? 0)} suffix="€" />
          <NumberField label="Afstand enkele rit" value={draft.distanceDeciKm} decimals={1} max={100000} onChange={v => set('distanceDeciKm', v ?? 0)} suffix="km" />
          <NumberField label="Eigen verplaatsingsbedrag" value={draft.travelOverrideCents} nullable onChange={v => set('travelOverrideCents', v)} suffix="€" hint={`Automatisch: ${money(r.automaticTravelCents)} excl. btw`} />
          <div className="span-2"><Field label="Opmerkingen op de offerte"><textarea value={draft.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Bijvoorbeeld: uitvoering op afspraak." /></Field></div>
        </div>
        {(settings.vatBps !== 2100 || settings.vatRegime === 'exempt') && <Notice tone="warning"><p>{settings.vatRegime === 'exempt' ? 'Btw-vrijstelling' : `${settings.vatBps / 100}% btw`} geselecteerd. Controleer of dit op deze activiteit van toepassing is. Ramenwas wordt niet automatisch aan 6% belast.</p><label className="check"><input type="checkbox" checked={draft.vatConfirmed} onChange={e => set('vatConfirmed', e.target.checked)} />Ik bevestig de toepasselijkheid voor deze offerte.</label></Notice>}
        <details className="manual-price"><summary>Eindprijs handmatig aanpassen <ChevronDown size={16} /></summary><p>Automatisch berekend: <strong>{money(r.automaticTotalCents)}</strong>. De eigen eindprijs blijft behouden wanneer je aantallen wijzigt.</p><NumberField label="Handmatige eindprijs exclusief btw" value={draft.manualTotalCents} nullable onChange={v => set('manualTotalCents', v)} suffix="€" />{draft.manualTotalCents !== null && <button className="text-button" onClick={() => set('manualTotalCents', null)}>Terug naar automatische prijs</button>}{r.manualWarnings.length > 0 && <Notice tone="warning">{r.manualWarnings.map(w => <p key={w}>{w}</p>)}<label className="check"><input type="checkbox" checked={draft.manualConfirmed} onChange={e => set('manualConfirmed', e.target.checked)} />Ik aanvaard deze afwijking bewust.</label></Notice>}</details>
      </div></details>
    </div><aside className="calculator-summary"><section className="card section"><div className="section-header"><span className="section-icon"><FileText size={19} /></span><div><h2>Prijsoverzicht</h2><p>Direct berekend, inclusief alle aanpassingen.</p></div></div><div className="section-body"><Field label="Reiniging van de ramen"><select aria-label="Reiniging van de ramen" value={draft.windowCleaning} onChange={e => set('windowCleaning', e.target.value as Draft['windowCleaning'])}><option value="outside">Enkel buiten</option><option value="both">Binnen &amp; buiten (+75%)</option></select></Field><p className="micro">De toeslag geldt alleen op de getelde ramen; de aantallen blijven gelijk. De geschatte raamtijd stijgt ook met 75%.</p><PriceSummary result={r} settings={settings} />{r.issues.length > 0 && <Notice tone="warning"><strong>Nog te controleren</strong><ul>{r.issues.map(i => <li key={i}>{i}</li>)}</ul></Notice>}<button className="button secondary full-width" disabled={busy || errors.length > 0} onClick={onPdf}><FileText size={17} />PDF vooraf bekijken</button><p className="micro">Alle stukprijzen en arbeidsbedragen zijn exclusief btw. Je gegevens blijven op dit toestel.</p></div></section></aside></div>
    {showErrors && errors.length > 0 && <Notice tone="warning"><strong>Deze offerte kan nog niet opgeslagen worden</strong><ul>{errors.map(e => <li key={e}>{e}</li>)}</ul></Notice>}
    <div className="price-bar"><div><small>{r.issues.some(i => i.startsWith('Stel')) ? 'Voorlopig totaal' : 'Totaal exclusief btw'}</small><strong>{money(r.exclusiveCents)}</strong><span>{duration(r.totalMinutes)}</span></div><button className="button primary" onClick={() => { if (errors.length) { setShowErrors(true); return }; setShowErrors(false); onSave() }} disabled={busy}><Save size={18} />{busy ? 'Bezig…' : 'Offerte opslaan'}</button></div>
  </>
}
