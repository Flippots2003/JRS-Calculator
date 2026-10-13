import type { Customer } from '../domain/models'
import { Field, TextField } from './Fields'
export function CustomerForm({ value, onChange }: { value: Customer; onChange: (value: Customer) => void }) {
  const set = <K extends keyof Customer>(key: K, next: Customer[K]) => onChange({ ...value, [key]: next })
  return <div className="form-grid">
    <div className="span-2"><TextField label="Klantnaam / bedrijfsnaam *" value={value.name} onChange={v => set('name', v)} placeholder="Naam van de klant" required /></div>
    <Field label="Type klant"><select value={value.type} onChange={e => set('type', e.target.value as Customer['type'])}><option value="private">Particulier</option><option value="business">Onderneming</option></select></Field>
    <TextField label="Contactpersoon" value={value.contact} onChange={v => set('contact', v)} />
    <div className="span-2"><TextField label="Straat en huisnummer *" value={value.street} onChange={v => set('street', v)} placeholder="Straat 12" /></div>
    <TextField label="Postcode *" value={value.postcode} onChange={v => set('postcode', v)} />
    <TextField label="Gemeente *" value={value.city} onChange={v => set('city', v)} />
    <TextField label="Telefoonnummer" type="tel" value={value.phone} onChange={v => set('phone', v)} />
    <TextField label="E-mailadres" type="email" value={value.email} onChange={v => set('email', v)} />
    <div className="span-2"><TextField label="Btw-nummer (optioneel)" value={value.vatNumber} onChange={v => set('vatNumber', v)} /></div>
    <label className="check span-2"><input type="checkbox" checked={value.separateAddress} onChange={e => set('separateAddress', e.target.checked)} />Ander uitvoeringsadres</label>
    {value.separateAddress && <div className="span-2"><Field label="Uitvoeringsadres *"><textarea value={value.executionAddress} onChange={e => set('executionAddress', e.target.value)} rows={2} /></Field></div>}
    <div className="span-2"><Field label="Klantopmerkingen (intern)"><textarea value={value.notes} onChange={e => set('notes', e.target.value)} rows={2} /></Field></div>
  </div>
}
