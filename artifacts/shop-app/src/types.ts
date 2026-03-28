export interface LedgerRow {
  id?: number;
  entry_id?: number;
  mark: string;
  qty1: number;
  rate1: number;
  qty2: number;
  rate2: number;
  qty3: number;
  rate3: number;
  total_qty: number;
  truck_no: string;
  override_station: number | null;
  override_commission: number | null;
  override_truck: number | null;
  override_pt: number | null;
}

export interface LedgerEntry {
  id: number;
  date: string;
  description: string;
  payment_status: "paid" | "unpaid";
  created_at: string;
  rows: LedgerRow[];
}

export interface CalcSettings {
  id: number;
  station_rate: number;
  commission_pct: number;
  truck_fare: number;
  pt_rate: number;
  custom_fields: CustomField[];
}

export interface CustomField {
  name: string;
  default_value: number;
  per_unit: boolean;
}

export interface RowCalc {
  amount: number;
  station: number;
  commission: number;
  truck: number;
  pt: number;
  customValues: Record<string, number>;
  customTotal: number;
  expenses: number;
  net: number;
  net_per_box: number;
  total_net: number;
  total_net_per_box: number;
}
