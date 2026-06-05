import { format } from 'date-fns'

export function calcularProximaApos(
  tipo: 'dia_mes' | 'dia_semana',
  valor: number,
  apos: Date,
): string {
  const d = new Date(apos)
  d.setHours(0, 0, 0, 0)

  if (tipo === 'dia_mes') {
    let next = new Date(d.getFullYear(), d.getMonth(), valor)
    if (next <= d) {
      next = new Date(d.getFullYear(), d.getMonth() + 1, valor)
    }
    return format(next, 'yyyy-MM-dd')
  } else {
    const currentDay = d.getDay()
    let daysUntil = (valor - currentDay + 7) % 7
    if (daysUntil === 0) daysUntil = 7
    const next = new Date(d)
    next.setDate(next.getDate() + daysUntil)
    return format(next, 'yyyy-MM-dd')
  }
}
