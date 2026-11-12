import type { ChartSpec } from '../../../shared/types'
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!)
const trunc = (s: string, n = 24) => s.length > n ? `${s.slice(0, n - 1)}…` : s
const colors = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#4b5563', '#65a30d', '#ea580c']
export function chartToSvg(chart: ChartSpec): string {
  if (chart.type === 'pie') {
    const values = chart.series[0]?.values ?? [], sum = values.reduce((a, b) => a + Math.max(0, b), 0) || 1
    let angle = -Math.PI / 2
    const paths = values.map((value, i) => { const next = angle + Math.max(0, value) / sum * Math.PI * 2, x1 = 130 + 110 * Math.cos(angle), y1 = 150 + 110 * Math.sin(angle), x2 = 130 + 110 * Math.cos(next), y2 = 150 + 110 * Math.sin(next), large = next - angle > Math.PI ? 1 : 0, path = `M 130 150 L ${x1} ${y1} A 110 110 0 ${large} 1 ${x2} ${y2} Z`; angle = next; return `<path d="${path}" fill="${colors[i % colors.length]}"/>` }).join('')
    const legend = chart.labels.map((label, i) => `<text x="280" y="${42 + i * 26}" font-size="13" fill="#374151">${esc(trunc(label))} (${Math.round((values[i] ?? 0) / sum * 100)}%)</text>`).join('')
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 340" width="720" height="340"><rect width="720" height="340" fill="white"/>${paths}<circle cx="130" cy="150" r="58" fill="white"/>${legend}</svg>`
  }
  const values = chart.series[0]?.values ?? [], max = Math.max(1, ...values), left = 62, right = 20, top = 20, bottom = 62, plotW = 720 - left - right, plotH = 340 - top - bottom
  const grid = Array.from({ length: 5 }, (_, i) => { const y = top + i * plotH / 4; return `<line x1="${left}" y1="${y}" x2="${720 - right}" y2="${y}" stroke="#e5e7eb"/><text x="${left - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#6b7280">${Math.round(max * (4 - i) / 4)}</text>` }).join('')
  const step = plotW / Math.max(1, values.length), bars = values.map((v, i) => `<rect x="${left + i * step + step * 0.175}" y="${top + plotH * (1 - v / max)}" width="${step * 0.65}" height="${plotH * v / max}" rx="3" fill="${colors[0]}"/>`).join('')
  const points = values.map((v, i) => `${left + (i + 0.5) * step},${top + plotH * (1 - v / max)}`).join(' '), line = `<polyline points="${points}" fill="none" stroke="${colors[0]}" stroke-width="3"/>${values.map((v, i) => `<circle cx="${left + (i + 0.5) * step}" cy="${top + plotH * (1 - v / max)}" r="4" fill="${colors[0]}"/>`).join('')}`
  const indexes = chart.labels.length <= 12 ? chart.labels.map((_, i) => i) : Array.from({ length: 12 }, (_, i) => Math.round(i * (chart.labels.length - 1) / 11))
  const labels = indexes.map((i) => `<text x="${left + (i + 0.5) * step}" y="${top + plotH + 22}" text-anchor="middle" font-size="11" fill="#4b5563">${esc(trunc(chart.labels[i] ?? '', 12))}</text>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 340" width="720" height="340"><rect width="720" height="340" fill="white"/>${grid}${chart.type === 'line' ? line : bars}${labels}</svg>`
}
