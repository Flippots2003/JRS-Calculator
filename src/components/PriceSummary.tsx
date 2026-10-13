import { Clock3, Layers, Info } from 'lucide-react'
import type { Calculation } from '../domain/calculate'
import { duration, money, percent } from '../domain/money'
import type { Settings } from '../domain/models'
export function PriceSummary({ result: r, settings }: { result: Calculation; settings: Settings }) {
  const rows: [string, number][] = [['Stukprijzen arbeid', r.baseCents], ['Toeslagen (' + percent(r.surchargeBps) + ')', r.surchargeCents], ['Frequentiekorting', -r.frequencyDiscountCents], ['Extra korting', -r.extraDiscountCents], ['Uurlooncorrectie', r.hourlyCorrectionCents], ['Arbeid na correctie', r.laborCents], ['Materiaal voor klant', r.materialCents], ['Verplaatsing', r.travelCents], ['Minimumprijsaanpassing', r.minimumCorrectionCents]]
  return <>
    <div className="summary-stats"><span><Layers size={17} />{r.quantity} onderdelen</span><span><Clock3 size={17} />{duration(r.totalMinutes)}</span></div>
    <dl className="price-rows">{rows.map(([label, value]) => <div key={label} className={label.includes('correctie') && value > 0 ? 'highlight' : ''}><dt>{label}</dt><dd>{money(value)}</dd></div>)}</dl>
    {r.hourlyCorrectionCents > 0 && <p className="micro"><Info size={14} />{duration(r.totalMinutes)} × {money(settings.minimumHourlyCents)}/u = {money(r.minimumLaborCents)} minimaal voor arbeid.</p>}
    {r.totalCents !== r.automaticTotalCents && <dl className="price-rows"><div><dt>Automatisch berekend</dt><dd>{money(r.automaticTotalCents)}</dd></div><div><dt>Handmatige aanpassing</dt><dd>{money(r.totalCents - r.automaticTotalCents)}</dd></div></dl>}
    <dl className="price-rows totals"><div><dt>Exclusief btw</dt><dd>{money(r.exclusiveCents)}</dd></div><div><dt>Btw {percent(r.vatBps)}</dt><dd>{money(r.vatCents)}</dd></div><div className="grand-total"><dt>Inclusief btw</dt><dd>{r.issues.some(i => i.startsWith('Stel')) ? 'Nog onvolledig' : money(r.totalCents)}</dd></div></dl>
  </>
}
