import type { Customer } from '../domain/models'
import { customerAddress } from '../domain/customers'
import { Field, TextField } from './Fields'

export function CustomerForm({ value, onChange }: { value: Customer; onChange: (value: Customer) => void }) {
  const set = <K extends keyof Customer>(key: K, next: Customer[K]) => onChange({ ...value, [key]: next })
  return <div className="form-grid">
    <div className="span-2"><TextField label="Naam" value={value.name} onChange={v => set('name', v)} placeholder="Naam van de klant (optioneel)" /></div>
    <div className="span-2"><Field label="Adres"><textarea value={customerAddress(value)} onChange={e => onChange({ ...value, street: e.target.value, postcode: '', city: '' })} rows={2} maxLength={5000} placeholder="Straat, huisnummer en gemeente (optioneel)" /></Field></div>
    <TextField label="Telefoonnummer" type="tel" value={value.phone} onChange={v => set('phone', v)} />
    <TextField label="Btw-nummer (indien nodig)" value={value.vatNumber} onChange={v => set('vatNumber', v)} />
  </div>
}
