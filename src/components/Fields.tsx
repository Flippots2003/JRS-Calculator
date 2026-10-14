import { useEffect, useRef, useState, type ReactNode } from 'react'
import { decimalInput, parseDecimal } from '../domain/money'
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>
}
export function NumberField({ label, value, onChange, decimals = 2, nullable = false, max = 100_000_000, suffix, hint, ariaLabel }: {
  label: string; value: number | null; onChange: (value: number | null) => void; decimals?: number; nullable?: boolean; max?: number; suffix?: string; hint?: string; ariaLabel?: string
}) {
  const [raw, setRaw] = useState(value === null ? '' : decimals ? decimalInput(value, decimals) : String(value))
  const [invalid, setInvalid] = useState(false)
  const focused = useRef(false)
  useEffect(() => { if (!focused.current) { setRaw(value === null ? '' : decimals ? decimalInput(value, decimals) : String(value)); setInvalid(false) } }, [value, decimals])
  function change(text: string) {
    setRaw(text)
    if (!text && nullable) { setInvalid(false); onChange(null); return }
    const parsed = parseDecimal(text, decimals)
    const valid = parsed !== null && parsed <= max
    setInvalid(!valid)
    if (valid) onChange(parsed)
  }
  return <Field label={label} hint={invalid ? 'Voer een geldig, positief getal in.' : hint}>
    <span className={`input-suffix ${invalid ? 'invalid' : ''}`}><input aria-label={ariaLabel ?? label} aria-invalid={invalid} value={raw} onFocus={() => { focused.current = true }} onChange={e => change(e.target.value)} onBlur={() => { focused.current = false; setRaw(value === null ? '' : decimals ? decimalInput(value, decimals) : String(value)); setInvalid(false) }} inputMode={decimals ? 'decimal' : 'numeric'} placeholder={nullable ? 'Niet ingesteld' : '0'} />{suffix && <span aria-hidden="true">{suffix}</span>}</span>
  </Field>
}
export function TextField({ label, value, onChange, type = 'text', placeholder, required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; required?: boolean }) {
  return <Field label={label}><input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required} maxLength={5000} /></Field>
}
export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warning' | 'success' }) {
  return <div className={`notice ${tone}`}>{children}</div>
}
