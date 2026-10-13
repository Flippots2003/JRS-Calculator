import { useEffect, useState } from 'react'
import { Download, Share2 } from 'lucide-react'
import { Modal } from './Modal'
import { Notice } from './Fields'
import { downloadFile } from '../storage/backup'
export function PdfPreview({ blob, filename, onClose, onError }: { blob: Blob; filename: string; onClose: () => void; onError: (error: unknown) => void }) {
  const [url] = useState(() => URL.createObjectURL(blob))
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  const file = new File([blob], filename, { type: 'application/pdf' })
  const canShare = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
  async function share() { try { await navigator.share({ files: [file], title: filename }) } catch (e) { if (!(e instanceof DOMException && e.name === 'AbortError')) onError(e) } }
  return <Modal title="Offerte bekijken" onClose={onClose} wide><div className="actions"><button className="button primary" onClick={() => downloadFile(blob, filename)}><Download size={17} />PDF downloaden</button>{canShare && <button className="button secondary" onClick={() => void share()}><Share2 size={17} />Delen</button>}</div><iframe className="pdf-frame" title="PDF-offerte" src={url} /><Notice>Toont je browser geen PDF-voorbeeld? Download het bestand en open het met je PDF-app. Genereren en downloaden werken volledig offline.</Notice></Modal>
}
