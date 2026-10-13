import { useEffect, useState } from 'react'
import { Download, Smartphone } from 'lucide-react'
interface InstallPrompt extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
let pendingPrompt: InstallPrompt | null = null
let appInstalled = false
// Capture the browser event even before the user opens the installation panel.
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); pendingPrompt = e as InstallPrompt; window.dispatchEvent(new Event('jrs-install-state')) })
window.addEventListener('appinstalled', () => { appInstalled = true; pendingPrompt = null; window.dispatchEvent(new Event('jrs-install-state')) })
export function InstallHelp() {
  const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const standalone = () => appInstalled || window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  const [prompt, setPrompt] = useState<InstallPrompt | null>(pendingPrompt)
  const [installed, setInstalled] = useState(standalone)
  useEffect(() => {
    const listener = () => { setPrompt(pendingPrompt); setInstalled(standalone()) }
    window.addEventListener('jrs-install-state', listener)
    return () => window.removeEventListener('jrs-install-state', listener)
  }, [])
  async function install() { if (!prompt) return; await prompt.prompt(); await prompt.userChoice; pendingPrompt = null; window.dispatchEvent(new Event('jrs-install-state')) }
  return <section className="card section"><div className="section-header"><Smartphone size={20} /><h2>{isiOS ? 'Op iPhone installeren' : 'Op Android installeren'}</h2></div><div className="section-body">{installed ? <p>De app is in zelfstandige weergave geopend.</p> : <><p>{isiOS ? 'Open deze HTTPS-website in Safari op je iPhone.' : 'Open de gepubliceerde HTTPS-website in Chrome op je Android-telefoon.'}</p>{isiOS ? <ol><li>Tik op <strong>Delen</strong> in Safari.</li><li>Kies <strong>Zet op beginscherm</strong> en tik op <strong>Voeg toe</strong>.</li><li>Open de app via het nieuwe icoon en wacht tot “Offline beschikbaar” verschijnt.</li><li>Test daarna een herstart in vliegtuigmodus.</li></ol> : prompt ? <button className="button primary" onClick={() => void install()}><Download size={17} />Installeer app</button> : <ol><li>Tik op het browsermenu met de drie puntjes.</li><li>Kies <strong>App installeren</strong> of <strong>Toevoegen aan startscherm</strong>.</li><li>Open de app en wacht tot “Offline beschikbaar” verschijnt.</li><li>Test daarna een herstart in vliegtuigmodus.</li></ol>}</>}<p className="micro">Na het volledig cachen werken berekeningen, klanten, offertes en PDF’s zonder internet.</p></div></section>
}
