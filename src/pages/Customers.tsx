import { customerAddress, customerLabel } from '../domain/customers'
import { useState } from 'react'
import { FilePlus2, MapPin, Pencil, Plus, Search, Trash2, UserRound } from 'lucide-react'
import { emptyCustomer, type Customer, type Quote } from '../domain/models'
import { CustomerForm } from '../components/CustomerForm'
import { Notice } from '../components/Fields'
import { Modal } from '../components/Modal'
interface Props {
  customers: Customer[]; quotes: Quote[]; onSave: (customer: Customer) => Promise<boolean>
  onDelete: (customer: Customer) => void; onQuote: (customer: Customer) => void; onOpenQuote: (quote: Quote) => void; busy: boolean
}
export function CustomersPage({ customers, quotes, onSave, onDelete, onQuote, onOpenQuote, busy }: Props) {
  const [search, setSearch] = useState(''); const [editing, setEditing] = useState<Customer | null>(null)
  const matches = customers.filter(c => `${c.name} ${c.city} ${c.street} ${c.phone} ${c.vatNumber}`.toLocaleLowerCase('nl-BE').includes(search.toLocaleLowerCase('nl-BE')))
  function close() { if (editing && JSON.stringify(editing) !== JSON.stringify(customers.find(c => c.id === editing.id) ?? emptyCustomer()) && !window.confirm('Niet-opgeslagen klantwijzigingen weggooien?')) return; setEditing(null) }
  return <>
    <div className="page-heading"><div><p className="eyebrow">EEN PERSOONLIJK OVERZICHT</p><h1>Klanten</h1><p>{customers.length} {customers.length === 1 ? 'klant' : 'klanten'}, lokaal op dit toestel.</p></div><button className="button primary" onClick={() => setEditing(emptyCustomer())}><Plus size={18} />Nieuwe klant</button></div>
    <label className="search"><Search size={19} /><input aria-label="Klanten zoeken" value={search} onChange={e => setSearch(e.target.value)} placeholder="Zoek op naam, gemeente of adres" /></label>
    {!matches.length && <div className="card empty-state"><UserRound size={38} /><h2>{search ? 'Geen klanten gevonden' : 'Je eerste klant begint hier'}</h2><p>{search ? 'Probeer een andere zoekterm.' : 'Voeg een klant toe of sla klantgegevens op vanuit de calculator.'}</p></div>}
    <div className="list-grid">{matches.map(customer => <article className="card customer-card" key={customer.id}><div className="customer-card-title"><span className="avatar">{customerLabel(customer).slice(0, 1).toUpperCase()}</span><div><h2>{customerLabel(customer)}</h2><p>{customer.phone}</p></div></div><p className="micro"><MapPin size={15} />{customerAddress(customer) || 'Geen adres ingevuld'}</p><p className="micro">{quotes.filter(q => q.draft.customer.id === customer.id).length} offertes</p><div className="actions"><button className="button secondary" onClick={() => onQuote(customer)}><FilePlus2 size={16} />Offerte</button><button className="icon-button button secondary" onClick={() => setEditing(structuredClone(customer))} aria-label={`${customerLabel(customer)} bewerken`}><Pencil size={17} /></button><button className="icon-button button secondary danger" onClick={() => onDelete(customer)} aria-label={`${customerLabel(customer)} verwijderen`}><Trash2 size={17} /></button></div></article>)}</div>
    {editing && <Modal title={editing.id ? 'Klant bewerken' : 'Nieuwe klant'} onClose={close}><form onSubmit={async e => { e.preventDefault(); if (await onSave(editing)) setEditing(null) }}><CustomerForm value={editing} onChange={setEditing} /><div className="actions"><button className="button primary" type="submit" disabled={busy}>Klant opslaan</button></div></form>{editing.id && <div className="customer-history"><h3>Eerdere offertes</h3>{quotes.filter(q => q.draft.customer.id === editing.id).map(q => <button className="history-link" key={q.id} onClick={() => onOpenQuote(q)}>{q.number}<span>{q.status}</span></button>)}{!quotes.some(q => q.draft.customer.id === editing.id) && <Notice>Nog geen offertes voor deze klant.</Notice>}</div>}</Modal>}
  </>
}
