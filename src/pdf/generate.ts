import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { frequencyOptions, groups } from '../domain/catalog'
import type { Quote } from '../domain/models'
import { duration, money, percent } from '../domain/money'

const date = (value: string) => new Date(value + 'T12:00:00').toLocaleDateString('nl-BE')
export function generatePdf(quote: Quote) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const { company } = quote.settings; const customer = quote.draft.customer
  const r = quote.result
  const green: [number, number, number] = [22, 78, 68]
  const dark: [number, number, number] = [32, 49, 44]
  const muted: [number, number, number] = [90, 109, 100]
  let y = 20
  doc.setProperties({ title: `Offerte ${quote.number}`, author: company.name, subject: `Offerte voor ${customer.name}` })
  doc.setFillColor(...green); doc.rect(0, 0, 210, 4, 'F')
  let nameX = 18
  if (company.logo) {
    const props = doc.getImageProperties(company.logo)
    const scale = Math.min(28 / props.width, 19 / props.height)
    doc.addImage(company.logo, 'PNG', 18, 14, props.width * scale, props.height * scale)
    nameX = 52
  }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(...green)
  doc.text(doc.splitTextToSize(company.name || "Jarne's Ramenservice", 115 - (nameX - 18)), nameX, y)
  doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(...muted)
  const companyLines = [company.address, [company.phone, company.email].filter(Boolean).join(' · '), company.website, company.enterpriseNumber ? `Ondernemingsnummer: ${company.enterpriseNumber}` : '', company.vatNumber ? `Btw: ${company.vatNumber}` : ''].filter(Boolean).flatMap(s => doc.splitTextToSize(s, 112) as string[])
  let cy = 30
  for (const line of companyLines) { doc.text(line, 18, cy); cy += 5 }
  if (!company.address || !company.enterpriseNumber) { doc.setFontSize(8); doc.text('Bedrijfsgegevens nog aan te vullen', 18, cy); cy += 5 }
  doc.setTextColor(...green); doc.setFont('helvetica', 'bold'); doc.setFontSize(25); doc.text('OFFERTE', 192, 20, { align: 'right' })
  doc.setTextColor(...dark); doc.setFontSize(10); doc.text(quote.number, 192, 29, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setTextColor(...muted)
  doc.text(`Datum: ${date(quote.date)}`, 192, 36, { align: 'right' })
  doc.text(`Geldig t.e.m. ${date(quote.validUntil)}`, 192, 42, { align: 'right' })
  y = Math.max(cy + 10, 60)
  function textBlock(text: string, size = 10, bold = false) {
    doc.setFontSize(size); doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setTextColor(...dark)
    for (const line of doc.splitTextToSize(text, 174) as string[]) {
      if (y > 265) { doc.addPage(); y = 20 }
      doc.text(line, 18, y); y += size * 0.45 + 1
    }
  }
  textBlock('VOOR', 9, true); textBlock(customer.name, 13, true)
  if (customer.contact) textBlock(`Ter attentie van ${customer.contact}`)
  textBlock(`${customer.street}\n${customer.postcode} ${customer.city}`)
  if (customer.phone || customer.email) textBlock([customer.phone, customer.email].filter(Boolean).join(' · '))
  if (customer.vatNumber) textBlock(`Btw: ${customer.vatNumber}`)
  if (customer.separateAddress) { y += 3; textBlock('Uitvoeringsadres', 9, true); textBlock(customer.executionAddress) }
  y += 6
  const body: (string[] | { content: string; colSpan: number; styles: { fillColor: [number, number, number]; textColor: [number, number, number]; fontStyle: 'bold' } }[])[] = []
  for (const group of groups) {
    const lines = r.lines.filter(l => l.group === group.id)
    if (!lines.length) continue
    body.push([{ content: group.name, colSpan: 4, styles: { fillColor: [237, 244, 240], textColor: green, fontStyle: 'bold' } }])
    for (const line of lines) body.push([line.name + (line.note ? '\n' + line.note : ''), String(line.quantity), money(line.unitCents!), money(line.totalCents)])
    body.push(['Subtotaal ' + group.short.toLowerCase(), '', '', money(lines.reduce((s, l) => s + l.totalCents, 0))])
  }
  const adjustments: [string, number][] = [['Toeslagen (' + percent(r.surchargeBps) + ')', r.surchargeCents], ['Frequentiekorting', -r.frequencyDiscountCents], ['Extra korting', -r.extraDiscountCents], ['Uurlooncorrectie', r.hourlyCorrectionCents], ['Materiaalkosten', r.materialCents], ['Verplaatsingskosten', r.travelCents], ['Minimumprijsaanpassing', r.minimumCorrectionCents], ['Handmatige prijsaanpassing', r.totalCents - r.automaticTotalCents]]
  for (const [label, amount] of adjustments) if (amount) body.push([label, '', '', money(amount)])
  autoTable(doc, { startY: y, head: [['Dienst / aanpassing (incl. btw)', 'Aantal', 'Per stuk', 'Bedrag']], body,
    margin: { left: 18, right: 18, top: 18, bottom: 25 },
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 3.5, textColor: dark, lineColor: [227, 235, 230], lineWidth: 0.1 },
    headStyles: { fillColor: green, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 96 }, 1: { halign: 'right', cellWidth: 17 }, 2: { halign: 'right', cellWidth: 29 }, 3: { halign: 'right', cellWidth: 32 } },
  })
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  if (y > 224) { doc.addPage(); y = 20 }
  doc.setFontSize(10); doc.setFont('helvetica', 'normal')
  doc.text('Totaal exclusief btw', 110, y); doc.text(money(r.exclusiveCents), 192, y, { align: 'right' }); y += 7
  doc.text(`Btw ${percent(r.vatBps)}`, 110, y); doc.text(money(r.vatCents), 192, y, { align: 'right' }); y += 5
  doc.setFillColor(...green); doc.roundedRect(106, y, 86, 14, 2, 2, 'F')
  doc.setTextColor(255, 255, 255); doc.setFontSize(12); doc.setFont('helvetica', 'bold')
  doc.text('Totaal incl. btw', 110, y + 9); doc.text(money(r.totalCents), 188, y + 9, { align: 'right' }); y += 24
  textBlock(`Frequentie: ${frequencyOptions[quote.draft.frequency]}. Geschatte werkduur: ${duration(r.totalMinutes)}.`, 9)
  if (quote.settings.vatRegime === 'exempt' || r.vatBps !== 2100) textBlock(quote.settings.vatExplanation || 'Afwijkend btw-tarief handmatig geselecteerd.', 9)
  for (const [heading, content] of [['Werkzaamheden', company.quoteText], ['Opmerkingen', quote.draft.notes], ['Betaling', company.payment], ['Algemene voorwaarden', company.terms]]) {
    if (content) { y += 5; textBlock(heading, 10, true); textBlock(content, 9) }
  }
  y += 5; textBlock(`Deze offerte is geldig tot en met ${date(quote.validUntil)}.`, 9)
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page); doc.setDrawColor(222, 230, 225); doc.line(18, 276, 192, 276)
    doc.setTextColor(...muted); doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
    doc.text(`${quote.number} · ${company.name}`, 18, 282)
    doc.text(`${page} / ${pages}`, 192, 282, { align: 'right' })
  }
  return doc.output('blob')
}
export const pdfFilename = (quote: Quote) => `JRS-Offerte-${quote.number.replace('JRS-', '')}.pdf`
