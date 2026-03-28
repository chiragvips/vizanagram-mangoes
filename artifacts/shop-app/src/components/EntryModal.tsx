import { useState } from "react";
import { X, Plus } from "lucide-react";
import type { LedgerEntry, LedgerRow, CalcSettings } from "../types";
import { calcRow, fmtINR } from "../lib/calculations";

interface RowDraft {
  mark: string;
  submark1: string; qty1: string; rate1: string;
  submark2: string; qty2: string; rate2: string;
  submark3: string; qty3: string; rate3: string;
  truck_no: string;
  override: boolean;
  override_station: string;
  override_commission: string;
  override_truck: string;
  override_pt: string;
}

function emptyRow(): RowDraft {
  return {
    mark: "", submark1: "", qty1: "0", rate1: "0.00",
    submark2: "", qty2: "0", rate2: "0.00",
    submark3: "", qty3: "0", rate3: "0.00",
    truck_no: "", override: false,
    override_station: "", override_commission: "", override_truck: "", override_pt: "",
  };
}

function draftToRow(d: RowDraft): Partial<LedgerRow> {
  return {
    mark: d.mark,
    submark1: d.submark1, qty1: Number(d.qty1)||0, rate1: Number(d.rate1)||0,
    submark2: d.submark2, qty2: Number(d.qty2)||0, rate2: Number(d.rate2)||0,
    submark3: d.submark3, qty3: Number(d.qty3)||0, rate3: Number(d.rate3)||0,
    total_qty: (Number(d.qty1)||0)+(Number(d.qty2)||0)+(Number(d.qty3)||0),
    truck_no: d.truck_no,
    override_station: d.override && d.override_station !== "" ? Number(d.override_station) : null,
    override_commission: d.override && d.override_commission !== "" ? Number(d.override_commission) : null,
    override_truck: d.override && d.override_truck !== "" ? Number(d.override_truck) : null,
    override_pt: d.override && d.override_pt !== "" ? Number(d.override_pt) : null,
  };
}

interface Props {
  mode: "new" | "edit";
  entry?: LedgerEntry;
  settings: CalcSettings;
  onSave: (date: string, description: string, rows: Partial<LedgerRow>[]) => void;
  onClose: () => void;
  saving?: boolean;
}

export default function EntryModal({ mode, entry, settings, onSave, onClose, saving }: Props) {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(entry?.date ?? today);
  const [description, setDescription] = useState(entry?.description ?? "");
  const [rows, setRows] = useState<RowDraft[]>(() => {
    if (entry?.rows?.length) {
      return entry.rows.map(r => ({
        mark: r.mark ?? "",
        submark1: r.submark1 ?? "", qty1: String(r.qty1 ?? 0), rate1: String(r.rate1 ?? 0),
        submark2: r.submark2 ?? "", qty2: String(r.qty2 ?? 0), rate2: String(r.rate2 ?? 0),
        submark3: r.submark3 ?? "", qty3: String(r.qty3 ?? 0), rate3: String(r.rate3 ?? 0),
        truck_no: r.truck_no ?? "",
        override: r.override_station !== null || r.override_commission !== null || r.override_truck !== null || r.override_pt !== null,
        override_station: r.override_station !== null ? String(r.override_station) : "",
        override_commission: r.override_commission !== null ? String(r.override_commission) : "",
        override_truck: r.override_truck !== null ? String(r.override_truck) : "",
        override_pt: r.override_pt !== null ? String(r.override_pt) : "",
      }));
    }
    return [emptyRow()];
  });

  function setRow(i: number, patch: Partial<RowDraft>) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  }

  function addRow() { setRows(prev => [...prev, emptyRow()]); }
  function removeRow(i: number) { setRows(prev => prev.filter((_, idx) => idx !== i)); }

  function handleSave() {
    const validRows = rows.filter(r => r.mark.trim());
    if (!validRows.length) return;
    onSave(date, description, validRows.map(draftToRow));
  }

  const numCls = "w-full bg-gray-100 dark:bg-[#1c2333] border border-gray-200 dark:border-[#30363d] rounded px-2 py-1.5 text-gray-900 dark:text-white text-sm text-right focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
  const textCls = "w-full bg-gray-100 dark:bg-[#1c2333] border border-gray-200 dark:border-[#30363d] rounded px-2 py-1.5 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
  const submarkCls = "w-full bg-orange-50 dark:bg-[#1a1708] border border-orange-300 dark:border-orange-800 rounded px-2 py-1.5 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500";
  const rateNumCls = "w-full bg-blue-50 dark:bg-[#12203a] border border-blue-300 dark:border-blue-700 rounded px-2 py-1.5 text-gray-900 dark:text-white text-sm text-right focus:outline-none focus:border-blue-500";

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-[#30363d] rounded-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-[#30363d]">
          <div className="flex items-center gap-3">
            <h2 className="text-gray-900 dark:text-white font-bold text-lg">{mode === "new" ? "New Entry" : "Edit Entry"}</h2>
            <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">{rows.length} row{rows.length !== 1 ? "s" : ""}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition"><X size={20} /></button>
        </div>

        <div className="px-6 py-4 flex items-center gap-4 border-b border-gray-200 dark:border-[#30363d] flex-wrap">
          <div>
            <label className="text-gray-600 dark:text-gray-300 text-sm font-medium whitespace-nowrap block mb-1">Date (shared for all rows)</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="bg-gray-100 dark:bg-[#1c2333] border border-gray-200 dark:border-[#30363d] rounded px-3 py-1.5 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-44" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-gray-600 dark:text-gray-300 text-sm font-medium whitespace-nowrap block mb-1">Description (optional, shown on invoice)</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Lot from Vizianagram station..."
              className="w-full bg-gray-100 dark:bg-[#1c2333] border border-gray-200 dark:border-[#30363d] rounded px-3 py-1.5 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
          </div>
        </div>

        <div className="px-6 pt-4">
          <div className="grid text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2" style={{ gridTemplateColumns: "120px 80px 56px 72px 80px 56px 72px 80px 56px 72px 60px 1fr 32px" }}>
            <div>MARK *</div>
            <div className="text-center text-orange-500 dark:text-orange-400">SUB 1</div>
            <div className="text-center">QTY1<br/><span className="text-gray-400 dark:text-gray-600">(5kg)</span></div>
            <div className="text-blue-500 dark:text-blue-400 text-center">RATE1</div>
            <div className="text-center text-orange-500 dark:text-orange-400">SUB 2</div>
            <div className="text-center">QTY2<br/><span className="text-gray-400 dark:text-gray-600">(10kg)</span></div>
            <div className="text-blue-500 dark:text-blue-400 text-center">RATE2</div>
            <div className="text-center text-orange-500 dark:text-orange-400">SUB 3</div>
            <div className="text-center">QTY3<br/><span className="text-gray-400 dark:text-gray-600">(15kg)</span></div>
            <div className="text-blue-500 dark:text-blue-400 text-center">RATE3</div>
            <div className="text-center">TOTAL<br/><span className="text-gray-400 dark:text-gray-600">(auto)</span></div>
            <div>TRUCK NO</div>
            <div></div>
          </div>

          <div className="space-y-3">
            {rows.map((row, i) => {
              const rd = draftToRow(row);
              const calc = calcRow({ ...rd, override_station: rd.override_station ?? null, override_commission: rd.override_commission ?? null, override_truck: rd.override_truck ?? null, override_pt: rd.override_pt ?? null } as any, settings);
              const total = (Number(row.qty1)||0)+(Number(row.qty2)||0)+(Number(row.qty3)||0);
              return (
                <div key={i} className="bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] rounded-lg p-3">
                  <div className="grid gap-2 items-center" style={{ gridTemplateColumns: "120px 80px 56px 72px 80px 56px 72px 80px 56px 72px 60px 1fr 32px" }}>
                    <input className={textCls} placeholder="e.g. KG" value={row.mark}
                      onChange={e => setRow(i, { mark: e.target.value })} />
                    <input className={submarkCls} placeholder="sub1" value={row.submark1}
                      onChange={e => setRow(i, { submark1: e.target.value })} />
                    <input className={numCls} type="number" min="0" value={row.qty1}
                      onChange={e => setRow(i, { qty1: e.target.value })} />
                    <input className={rateNumCls} type="number" min="0" step="0.01" value={row.rate1}
                      onChange={e => setRow(i, { rate1: e.target.value })} />
                    <input className={submarkCls} placeholder="sub2" value={row.submark2}
                      onChange={e => setRow(i, { submark2: e.target.value })} />
                    <input className={numCls} type="number" min="0" value={row.qty2}
                      onChange={e => setRow(i, { qty2: e.target.value })} />
                    <input className={rateNumCls} type="number" min="0" step="0.01" value={row.rate2}
                      onChange={e => setRow(i, { rate2: e.target.value })} />
                    <input className={submarkCls} placeholder="sub3" value={row.submark3}
                      onChange={e => setRow(i, { submark3: e.target.value })} />
                    <input className={numCls} type="number" min="0" value={row.qty3}
                      onChange={e => setRow(i, { qty3: e.target.value })} />
                    <input className={rateNumCls} type="number" min="0" step="0.01" value={row.rate3}
                      onChange={e => setRow(i, { rate3: e.target.value })} />
                    <div className="bg-gray-100 dark:bg-[#1c2333] border border-gray-200 dark:border-[#30363d] rounded px-2 py-1.5 text-gray-600 dark:text-gray-300 text-sm text-right">{total > 0 ? total : "—"}</div>
                    <input className={textCls} placeholder="e.g. TN-01" value={row.truck_no}
                      onChange={e => setRow(i, { truck_no: e.target.value })} />
                    <button onClick={() => removeRow(i)} className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition flex items-center justify-center">
                      <X size={16} />
                    </button>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <input type="checkbox" id={`ov-${i}`} checked={row.override} onChange={e => setRow(i, { override: e.target.checked })}
                      className="rounded border-gray-300 dark:border-gray-600" />
                    <label htmlFor={`ov-${i}`} className="text-gray-500 dark:text-gray-400 text-xs">Override calculated values — leave blank to auto-calculate</label>
                  </div>

                  {row.override && (
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {[["Station", "override_station"], ["Commission", "override_commission"], ["Truck Fare", "override_truck"], ["P & T", "override_pt"]].map(([label, field]) => (
                        <div key={field}>
                          <label className="text-xs text-gray-500 dark:text-gray-500 mb-1 block">{label}</label>
                          <input className={numCls} type="number" step="0.01"
                            placeholder="auto"
                            value={(row as any)[field]}
                            onChange={e => setRow(i, { [field]: e.target.value } as any)} />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 text-xs flex gap-4 text-gray-500 dark:text-gray-400">
                    <span>Amt: <span className="text-gray-900 dark:text-white font-medium">₹{fmtINR(calc.amount)}</span></span>
                    <span>Exp: <span className="text-red-500 dark:text-red-400 font-medium">₹{fmtINR(calc.expenses)}</span></span>
                    <span>Net: <span className={`font-medium ${calc.net >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>₹{fmtINR(calc.net)}</span></span>
                    <span>Net/box: <span className={`font-medium ${calc.net_per_box >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>₹{fmtINR(calc.net_per_box)}</span></span>
                    {(settings.custom_fields ?? []).map(f => (
                      <span key={f.name}>{f.name}: <span className="text-purple-600 dark:text-purple-400 font-medium">₹{fmtINR(calc.customValues[f.name] ?? 0)}</span></span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <button onClick={addRow}
            className="mt-3 w-full border border-dashed border-gray-300 dark:border-[#30363d] rounded-lg py-2.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-blue-500 dark:hover:border-blue-600 transition text-sm flex items-center justify-center gap-2">
            <Plus size={14} /> Add Row
          </button>
        </div>

        <div className="px-6 py-4 flex justify-end gap-3 border-t border-gray-200 dark:border-[#30363d] mt-4">
          <button onClick={onClose} className="px-5 py-2 rounded-lg border border-gray-200 dark:border-[#30363d] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1c2333] transition text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition disabled:opacity-50">
            {saving ? "Saving..." : mode === "new" ? "Create Entry" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
