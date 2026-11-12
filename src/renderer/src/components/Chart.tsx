import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import type { ChartSpec } from '../../../shared/types'
export default function Chart({ spec }: { spec: ChartSpec }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current) return
    const chart = echarts.init(ref.current)
    const option: echarts.EChartsOption = spec.type === 'pie' ? { tooltip: { trigger: 'item' }, legend: { bottom: 0, type: 'scroll' }, series: [{ type: 'pie', radius: ['42%', '70%'], data: spec.labels.map((name, i) => ({ name, value: spec.series[0]?.values[i] ?? 0 })), label: { formatter: '{b}: {d}%' } }] } : { tooltip: { trigger: 'axis' }, legend: { top: 0 }, grid: { left: 50, right: 24, top: 40, bottom: 55 }, xAxis: { type: 'category', data: spec.labels, axisLabel: { rotate: spec.labels.length > 8 ? 30 : 0, hideOverlap: true } }, yAxis: { type: 'value', scale: true }, series: spec.series.map((s) => ({ name: s.name, type: spec.type, data: s.values, smooth: spec.type === 'line', itemStyle: { color: '#2563eb' }, areaStyle: spec.type === 'line' ? { opacity: 0.08 } : undefined })) }
    chart.setOption(option)
    const resize = () => chart.resize(), observer = new ResizeObserver(resize); observer.observe(ref.current); window.addEventListener('resize', resize)
    return () => { observer.disconnect(); window.removeEventListener('resize', resize); chart.dispose() }
  }, [spec])
  return <div className="chart" role="img" aria-label={spec.title} ref={ref} />
}
