import { jsPDF } from 'jspdf'
import type { FeedItem, RecipeData, ItineraryData } from '../services/feedService'

const BLACK  = '#111111'
const GRAY   = '#888888'
const LGRAY  = '#cccccc'
const BG     = '#f9f9f9'
const MARGIN = 18
const W      = 210 - MARGIN * 2  // usable width on A4

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b] as [number, number, number]
}

function setColor(doc: jsPDF, hex: string) {
  doc.setTextColor(...hexToRgb(hex))
}

function line(doc: jsPDF, y: number): number {
  doc.setDrawColor(...hexToRgb(LGRAY))
  doc.setLineWidth(0.3)
  doc.line(MARGIN, y, MARGIN + W, y)
  return y + 5
}

function sectionLabel(doc: jsPDF, text: string, y: number): number {
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  setColor(doc, GRAY)
  doc.text(text.toUpperCase(), MARGIN, y)
  return y + 5
}

function wrapText(doc: jsPDF, text: string, x: number, y: number, maxW: number, lineH: number): number {
  const lines = doc.splitTextToSize(text, maxW)
  doc.text(lines, x, y)
  return y + lines.length * lineH
}

// ── Recipe PDF ────────────────────────────────────────────────────────────────

function buildRecipePDF(doc: jsPDF, item: FeedItem, r: RecipeData) {
  let y = MARGIN + 6

  // Title block
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  setColor(doc, BLACK)
  const titleLines = doc.splitTextToSize(item.text || 'Recipe', W)
  doc.text(titleLines, MARGIN, y)
  y += titleLines.length * 9 + 3

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  setColor(doc, GRAY)
  doc.text(`by ${item.creator.display_name || item.creator.username}`, MARGIN, y)
  y += 8

  y = line(doc, y)

  // Meta row
  const metas: { label: string; value: string }[] = []
  if (r.servings)   metas.push({ label: 'Serves',    value: String(r.servings) })
  if (r.prep_time)  metas.push({ label: 'Prep time', value: r.prep_time })
  if (r.cook_time)  metas.push({ label: 'Cook time', value: r.cook_time })

  if (metas.length) {
    // Light background box
    doc.setFillColor(...hexToRgb(BG))
    doc.roundedRect(MARGIN, y, W, 18, 3, 3, 'F')
    const colW = W / metas.length
    metas.forEach((m, i) => {
      const cx = MARGIN + colW * i + colW / 2
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      setColor(doc, GRAY)
      doc.text(m.label, cx, y + 6, { align: 'center' })
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      setColor(doc, BLACK)
      doc.text(m.value, cx, y + 14, { align: 'center' })
    })
    y += 24
  }

  // Ingredients
  if (r.ingredients?.length) {
    y = sectionLabel(doc, 'Ingredients', y)
    r.ingredients.forEach(ing => {
      // bullet
      doc.setFillColor(...hexToRgb(BLACK))
      doc.circle(MARGIN + 1.5, y - 1.5, 0.9, 'F')
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      setColor(doc, BLACK)
      y = wrapText(doc, ing, MARGIN + 5, y, W - 6, 5.5)
      y += 1.5

      if (y > 270) { doc.addPage(); y = MARGIN }
    })
    y += 4
  }

  y = line(doc, y)

  // Steps
  if (r.steps?.length) {
    y = sectionLabel(doc, 'Steps', y)
    r.steps.forEach((step, i) => {
      if (y > 265) { doc.addPage(); y = MARGIN }

      // Step number circle
      doc.setFillColor(...hexToRgb(BLACK))
      doc.circle(MARGIN + 3, y - 1.5, 3, 'F')
      doc.setFontSize(7)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(255, 255, 255)
      doc.text(String(i + 1), MARGIN + 3, y - 0.5, { align: 'center' })

      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      setColor(doc, BLACK)
      y = wrapText(doc, step, MARGIN + 9, y, W - 10, 5.5)
      y += 3
    })
  }
}

// ── Itinerary PDF ─────────────────────────────────────────────────────────────

function buildItineraryPDF(doc: jsPDF, item: FeedItem, itin: ItineraryData) {
  let y = MARGIN + 6

  // Destination title
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  setColor(doc, BLACK)
  const dest = itin.destination || item.text || 'Itinerary'
  const titleLines = doc.splitTextToSize(dest, W - 20)
  doc.text(titleLines, MARGIN, y)

  // Globe emoji substitute (text)
  doc.setFontSize(26)
  doc.text('✈', MARGIN + W - 2, y, { align: 'right' })

  y += titleLines.length * 9 + 2

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  setColor(doc, GRAY)
  const sub = [
    `${itin.days?.length ?? 0} days`,
    itin.duration,
    `by ${item.creator.display_name || item.creator.username}`,
  ].filter(Boolean).join('  ·  ')
  doc.text(sub, MARGIN, y)
  y += 8

  y = line(doc, y)

  // Caption/teaser
  if (item.text && item.text !== itin.destination) {
    doc.setFontSize(11)
    doc.setFont('helvetica', 'italic')
    setColor(doc, GRAY)
    y = wrapText(doc, item.text, MARGIN, y, W, 5.5)
    y += 6
  }

  const stopTypeEmoji: Record<string, string> = {
    food: '🍴', hotel: '🏨', transport: '✈', attraction: '📍', other: '•',
  }

  itin.days?.forEach((day, di) => {
    if (y > 260) { doc.addPage(); y = MARGIN }

    // Day header band
    doc.setFillColor(...hexToRgb(BG))
    doc.roundedRect(MARGIN, y, W, 10, 2, 2, 'F')
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    setColor(doc, GRAY)
    const dayLabel = `Day ${day.day}${day.title ? `  —  ${day.title}` : ''}`
    doc.text(dayLabel.toUpperCase(), MARGIN + 4, y + 7)
    y += 14

    day.stops?.forEach(stop => {
      if (y > 270) { doc.addPage(); y = MARGIN }

      const emoji = stopTypeEmoji[stop.type ?? 'other'] ?? '•'
      // Emoji / type indicator
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      setColor(doc, GRAY)
      doc.text(emoji, MARGIN + 1, y)

      // Stop name
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      setColor(doc, BLACK)
      doc.text(stop.name, MARGIN + 8, y)
      y += 5.5

      // Notes
      if (stop.notes) {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        setColor(doc, GRAY)
        y = wrapText(doc, stop.notes, MARGIN + 8, y, W - 10, 5)
      }

      // Link
      if (stop.link) {
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(14, 165, 233)
        y = wrapText(doc, stop.link, MARGIN + 8, y, W - 10, 5)
      }

      y += 3
    })

    if (di < (itin.days?.length ?? 0) - 1) {
      y = line(doc, y)
    }
  })
}

// ── Footer ────────────────────────────────────────────────────────────────────

function addFooter(doc: jsPDF, pageCount: number) {
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    setColor(doc, LGRAY)
    doc.text('Generated via Oodle', MARGIN, 292)
    doc.text(`${i} / ${pageCount}`, 210 - MARGIN, 292, { align: 'right' })
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function generateAnswerPDF(item: FeedItem): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  if (item.post_subtype === 'recipe') {
    buildRecipePDF(doc, item, item.structured_data as RecipeData)
  } else if (item.post_subtype === 'itinerary') {
    buildItineraryPDF(doc, item, item.structured_data as ItineraryData)
  }

  addFooter(doc, doc.getNumberOfPages())
  return doc.output('blob')
}

export async function shareOrDownloadPDF(item: FeedItem) {
  const blob = generateAnswerPDF(item)
  const safeTitle = (item.text || item.post_subtype || 'answer')
    .replace(/[^a-z0-9]/gi, '_')
    .slice(0, 40)
  const filename = `${safeTitle}.pdf`
  const file = new File([blob], filename, { type: 'application/pdf' })

  // Try native share sheet first (iOS / Android)
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ title: filename, files: [file] })
    return
  }

  // Fallback: direct download
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href    = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
