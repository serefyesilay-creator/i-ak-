import type { Payment } from '@/types'

/** Fatura id → o faturaya girilmiş ödemelerin toplamı */
export type PaidMap = Record<string, number>

type InvoiceLike = { id: string; amount: number | string; status: string }

export function buildPaidMap(payments: Pick<Payment, 'invoice_id' | 'amount'>[]): PaidMap {
  const map: PaidMap = {}
  for (const p of payments) map[p.invoice_id] = (map[p.invoice_id] ?? 0) + Number(p.amount)
  return map
}

/** Alınan tutar: "Ödendi" işaretli fatura tamamen alınmış sayılır; diğerlerinde girilen ödemeler (tutarı aşmadan). */
export function paidOf(inv: InvoiceLike, map: PaidMap): number {
  const total = Number(inv.amount)
  if (inv.status === 'paid') return total
  return Math.min(total, map[inv.id] ?? 0)
}

export function remainingOf(inv: InvoiceLike, map: PaidMap): number {
  return Math.max(0, Number(inv.amount) - paidOf(inv, map))
}
