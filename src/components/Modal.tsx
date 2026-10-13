import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
export function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => { if (dialog.open) dialog.close() } }, [])
  return createPortal(<dialog ref={ref} className={`modal ${wide ? 'wide' : ''}`} onCancel={e => { e.preventDefault(); onClose() }} aria-label={title}><div className="modal-header"><h2>{title}</h2><button className="button secondary" onClick={onClose}>Sluiten</button></div>{children}</dialog>, document.body)
}
