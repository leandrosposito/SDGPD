import type { Currency } from '@/shared/types/client.types'

// Formato de monto en es-AR. Pesos (ARS) salvo que se indique otra moneda.
export function formatCurrency(value: number, currency: Currency = 'ARS'): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(value)
}

// Fecha corta en es-AR, por ejemplo "12 mar 2026".
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
