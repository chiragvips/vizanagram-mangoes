import type { LedgerEntry, CalcSettings, LedgerRow } from "../types";

const BASE = "/api";

export async function getEntries(): Promise<LedgerEntry[]> {
  const r = await fetch(`${BASE}/ledger/entries`);
  if (!r.ok) throw new Error("fetch entries failed");
  return r.json();
}

export async function createEntry(data: { date: string; description?: string; grower_name?: string; payment_status?: string; rows: Partial<LedgerRow>[] }): Promise<LedgerEntry> {
  const r = await fetch(`${BASE}/ledger/entries`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("create entry failed");
  return r.json();
}

export async function updateEntry(id: number, data: { date?: string; description?: string; grower_name?: string; payment_status?: string; rows?: Partial<LedgerRow>[] }): Promise<LedgerEntry> {
  const r = await fetch(`${BASE}/ledger/entries/${id}`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("update entry failed");
  return r.json();
}

export async function deleteEntry(id: number): Promise<void> {
  await fetch(`${BASE}/ledger/entries/${id}`, { method: "DELETE" });
}

export async function bulkDeleteEntries(ids: number[]): Promise<void> {
  await fetch(`${BASE}/ledger/entries/bulk-delete`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }),
  });
}

export async function updateRowPaymentStatus(rowId: number, payment_status: "paid" | "unpaid"): Promise<void> {
  const r = await fetch(`${BASE}/ledger/rows/${rowId}/payment`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payment_status }),
  });
  if (!r.ok) throw new Error("update row payment status failed");
}

export async function getSettings(): Promise<CalcSettings> {
  const r = await fetch(`${BASE}/ledger/settings`);
  if (!r.ok) throw new Error("fetch settings failed");
  const raw = await r.json();
  return {
    ...raw,
    station_rate: Number(raw.station_rate),
    commission_pct: Number(raw.commission_pct),
    truck_fare: Number(raw.truck_fare),
    pt_rate: Number(raw.pt_rate),
    custom_fields: raw.custom_fields ?? [],
  };
}

export async function saveSettings(data: Partial<CalcSettings>): Promise<CalcSettings> {
  const r = await fetch(`${BASE}/ledger/settings`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("save settings failed");
  return r.json();
}
