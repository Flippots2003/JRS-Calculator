import { useState } from 'react'
import { Copy, Download, FileText, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { statuses, type Quote } from '../domain/models'
import { money } from '../domain/money'
interface Props {
  quotes: Quote[]; onNew: () => void; onEdit: (quote: Quote) => void; onDuplicate: (quote: Quote) => void
  onDelete: (quote: Quote) => void; onPdf: (quote: Quote, preview?: boolean) => void
  onStatus: (quote: Quote, status: Quote['status']) => void; onRevision: (quote: Quote, index: number) => void
}
export function QuotesPage({ quotes, onNew, onEdit, onDuplicate, onDelete, onPdf, onStatus, onRevision }: Props) {
  const [search, setSearch] = useState(''); const [status, setStatus] = useState('Alle')
  const matches = quotes.filter(q => (status === 'Alle' || q.status === status) && `${q.number} ${q.draft.customer.name} ${q.draft.customer.city}`.toLowerCase().includes(search.toLowerCase()))
  return <>
    <div className="page-heading"><div><p className="eyebrow">ELKE AFSPRAAK BEWAARD</p><h1>Offertes</h1><p>{quotes.length} offertes met hun eigen prijsmomentopname.</p></div><button className="button primary" onClick={onNew}><Plus size={18} />Nieuwe offerte</button></div>
    <div className="filter-row"><label className="search"><Search size={19} /><input aria-label="Offertes zoeken" value={search} onChange={e => setSearch(e.target.value)} placeholder="Zoek op nummer of klant" /></label><select aria-label="Offertestatus filter" value={status} onChange={e => setStatus(e.target.value)}>{['Alle', ...statuses].map(s => <option key={s}>{s}</option>)}</select></div>
    {!matches.length && <div className="card empty-state"><FileText size={38} /><h2>{search || status !== 'Alle' ? 'Geen offertes gevonden' : 'Klaar voor je eerste offerte'}</h2><p>Opgeslagen offertes kun je hier bekijken, delen en aanpassen.</p><button className="button primary" onClick={onNew}>Naar de calculator</button></div>}
    <div className="quote-list">{matches.map(q => <article key={q.id} className="card quote-card"><div className="quote-top"><div><p className="eyebrow">{q.number}</p><h2>{q.draft.customer.name}</h2><p>{new Date(q.date + 'T12:00:00').toLocaleDateString('nl-BE')} · {q.draft.customer.city}</p></div><strong className="quote-amount">{money(q.result.totalCents)}</strong></div><div className="quote-bottom"><select className={`status status-${q.status.toLowerCase()}`} aria-label={`Status ${q.number}`} value={q.status} onChange={e => onStatus(q, e.target.value as Quote['status'])}>{statuses.map(s => <option key={s}>{s}</option>)}</select><div className="actions"><button className="button secondary" onClick={() => onPdf(q, true)}><FileText size={16} />Bekijken</button><button className="icon-button button secondary" onClick={() => onPdf(q)} aria-label={`PDF ${q.number} downloaden`}><Download size={17} /></button><button className="icon-button button secondary" onClick={() => onEdit(q)} aria-label={`${q.number} bewerken`}><Pencil size={17} /></button><button className="icon-button button secondary" onClick={() => onDuplicate(q)} aria-label={`${q.number} dupliceren`}><Copy size={17} /></button><button className="icon-button button secondary danger" onClick={() => onDelete(q)} aria-label={`${q.number} verwijderen`}><Trash2 size={17} /></button></div></div>{q.revisions.length > 0 && <details className="quote-revisions"><summary>{q.revisions.length} eerdere {q.revisions.length === 1 ? 'versie' : 'versies'} bewaard</summary>{q.revisions.map((version, i) => <button key={i} className="history-link" onClick={() => onRevision(q, i)}>Versie {i + 1} · {new Date(version.savedAt).toLocaleString('nl-BE')}<span>{money(version.result.totalCents)} · PDF</span></button>)}</details>}</article>)}</div>
  </>
}
