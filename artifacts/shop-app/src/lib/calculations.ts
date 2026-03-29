import type { LedgerRow, CalcSettings, RowCalc } from "../types";

export function calcRow(row: LedgerRow, s: CalcSettings): RowCalc {
  const qty1 = Number(row.qty1) || 0;
  const rate1 = Number(row.rate1) || 0;
  const qty2 = Number(row.qty2) || 0;
  const rate2 = Number(row.rate2) || 0;
  const qty3 = Number(row.qty3) || 0;
  const rate3 = Number(row.rate3) || 0;
  const totalQty = qty1 + qty2 + qty3;

  const amount = qty1 * rate1 + qty2 * rate2 + qty3 * rate3;

  const station = row.override_station !== null && row.override_station !== undefined
    ? Number(row.override_station)
    : totalQty * Number(s.station_rate);

  const commission = row.override_commission !== null && row.override_commission !== undefined
    ? Number(row.override_commission)
    : amount * Number(s.commission_pct) / 100;

  const truck = row.override_truck !== null && row.override_truck !== undefined
    ? Number(row.override_truck)
    : totalQty * Number(s.truck_fare);

  const pt = row.override_pt !== null && row.override_pt !== undefined
    ? Number(row.override_pt)
    : Number(s.pt_rate);

  const customValues: Record<string, number> = {};
  let customTotal = 0;
  const oc = (row as any).override_custom ?? {};
  for (const cf of s.custom_fields ?? []) {
    const hasOverride = oc[cf.name] !== undefined && oc[cf.name] !== null && oc[cf.name] !== "";
    const val = hasOverride
      ? Number(oc[cf.name])
      : (cf.per_unit ? totalQty * Number(cf.default_value) : Number(cf.default_value));
    customValues[cf.name] = val;
    customTotal += val;
  }

  const expenses = station + commission + truck + pt + customTotal;
  const net = amount - expenses;
  const net_per_box = totalQty > 0 ? net / totalQty : 0;
  const total_net = net * 1.02;
  const total_net_per_box = totalQty > 0 ? total_net / totalQty : 0;

  return { amount, station, commission, truck, pt, customValues, customTotal, expenses, net, net_per_box, total_net, total_net_per_box };
}

export function fmtINR(n: number, decimals = 2): string {
  if (!isFinite(n)) return "—";
  return n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}
