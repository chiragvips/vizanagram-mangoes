import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Filter, Download, Plus, Pencil, Trash2, ChevronDown } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import type { LedgerEntry, CalcSettings } from "./types";
import { calcRow, fmtINR } from "./lib/calculations";
import { getEntries, createEntry, updateEntry, deleteEntry, bulkDeleteEntries } from "./lib/api";
import EntryModal from "./components/EntryModal";

const COMPANY_INVOICE = "GangaRam MulChand & Sons";
const GXM_SYMBOL = "GXM";

interface Props { settings: CalcSettings; }

export default function LedgerDashboard({ settings }: Props) {
  const qc = useQueryClient();
  const { data: entries = [], isLoading } = useQuery({ queryKey: ["entries"], queryFn: getEntries });

  const [showFilter, setShowFilter] = useState(false);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [payFilter, setPayFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [modal, setModal] = useState<{ mode: "new" | "edit"; entry?: LedgerEntry } | null>(null);

  const createMut = useMutation({
    mutationFn: (d: any) => createEntry(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["entries"] }); setModal(null); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => updateEntry(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["entries"] }); setModal(null); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteEntry(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entries"] }),
  });
  const bulkDeleteMut = useMutation({
    mutationFn: (ids: number[]) => bulkDeleteEntries(ids),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["entries"] }); setSelected(new Set()); },
  });
  const payMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => updateEntry(id, { payment_status: status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entries"] }),
  });

  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (fromDate && e.date < fromDate) return false;
      if (toDate && e.date > toDate) return false;
      if (payFilter !== "all" && e.payment_status !== payFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const hasMatch = (e.rows ?? []).some(r => r.mark?.toLowerCase().includes(s));
        if (!hasMatch) return false;
      }
      return true;
    });
  }, [entries, fromDate, toDate, payFilter, search]);

  const allIds = useMemo(() => new Set(filtered.flatMap(e => (e.rows ?? []).map(r => e.id))), [filtered]);

  function toggleSelect(id: number) {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleAll() {
    const entryIds = filtered.map(e => e.id);
    if (entryIds.every(id => selected.has(id))) setSelected(new Set());
    else setSelected(new Set(entryIds));
  }

  function exportExcel() {
    const allRows: any[] = [];
    filtered.forEach(entry => {
      (entry.rows ?? []).forEach(row => {
        const c = calcRow(row as any, settings);
        allRows.push({
          Date: entry.date,
          Mark: row.mark,
          "Truck No": row.truck_no,
          "QTY1 (5kg)": Number(row.qty1),
          RATE1: Number(row.rate1),
          "QTY2 (10kg)": Number(row.qty2),
          RATE2: Number(row.rate2),
          "QTY3 (15kg)": Number(row.qty3),
          RATE3: Number(row.rate3),
          "Total QTY": Number(row.total_qty),
          Amount: c.amount,
          Station: c.station,
          Commission: c.commission,
          Truck: c.truck,
          "P&T": c.pt,
          Expenses: c.expenses,
          Net: c.net,
          "Net/Box": c.net_per_box,
          "Total Net": c.total_net,
          Payment: entry.payment_status,
        });
      });
    });
    const totalAmt = allRows.reduce((s, r) => s + r.Amount, 0);
    const totalExp = allRows.reduce((s, r) => s + r.Expenses, 0);
    const totalNet = allRows.reduce((s, r) => s + r.Net, 0);
    allRows.push({ Date: "GRAND TOTAL", Mark: "", Amount: totalAmt, Expenses: totalExp, Net: totalNet });

    const ws = XLSX.utils.json_to_sheet(allRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ledger");
    XLSX.writeFile(wb, "Vizianagram_Mangoes_Ledger.xlsx");
  }

  function exportInvoicePDF() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    let y = 14;

    doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 80, 180);
    doc.text(`${GXM_SYMBOL} — ${COMPANY_INVOICE}`, W / 2, y, { align: "center" });
    y += 7;
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 100, 100);
    doc.text("Mango Trading Ledger — Vizianagram Mangoes", W / 2, y, { align: "center" });
    y += 4;
    doc.setLineWidth(0.5); doc.setDrawColor(30, 80, 180); doc.line(10, y, W - 10, y);
    y += 6;

    const headers = ["Date", "Mark", "Truck", "QTY", "Amount", "Station", "Comm", "Truck Fare", "P&T", "Expenses", "Net", "Payment"];
    const colW = [22, 18, 22, 16, 24, 18, 18, 22, 12, 22, 22, 16];
    let x = 10;
    doc.setFillColor(30, 80, 180);
    doc.rect(10, y - 5, W - 20, 8, "F");
    doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
    headers.forEach((h, i) => { doc.text(h, x + 1, y); x += colW[i]; });
    y += 4;

    doc.setFont("helvetica", "normal");
    let grandAmt = 0, grandExp = 0, grandNet = 0;
    filtered.forEach((entry, ei) => {
      (entry.rows ?? []).forEach(row => {
        if (y > 185) { doc.addPage(); y = 15; }
        const c = calcRow(row as any, settings);
        grandAmt += c.amount; grandExp += c.expenses; grandNet += c.net;
        const bg = ei % 2 === 0 ? [248, 250, 255] : [255, 255, 255];
        doc.setFillColor(bg[0], bg[1], bg[2]);
        doc.rect(10, y - 3.5, W - 20, 7, "F");
        doc.setTextColor(30, 30, 30);
        const vals = [entry.date, row.mark, row.truck_no ?? "", String(Number(row.total_qty)),
          fmtINR(c.amount, 0), fmtINR(c.station, 0), fmtINR(c.commission, 0),
          fmtINR(c.truck, 0), fmtINR(c.pt, 0), fmtINR(c.expenses, 0), fmtINR(c.net, 0),
          entry.payment_status];
        x = 10;
        vals.forEach((v, i) => { doc.text(String(v).slice(0, 14), x + 1, y); x += colW[i]; });
        y += 7;
      });
    });

    y += 3;
    doc.setFillColor(30, 80, 180);
    doc.rect(10, y - 4, W - 20, 9, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(255, 255, 255);
    doc.text("GRAND TOTAL", 12, y + 1);
    doc.text(`Amt: ₹${fmtINR(grandAmt, 0)}`, 80, y + 1);
    doc.text(`Exp: ₹${fmtINR(grandExp, 0)}`, 145, y + 1);
    doc.text(`Net: ₹${fmtINR(grandNet, 0)}`, 210, y + 1);

    doc.save(`${GXM_SYMBOL}_Invoice.pdf`);
  }

  const dateGroups = useMemo(() => {
    const map = new Map<string, LedgerEntry[]>();
    filtered.forEach(e => {
      const d = e.date;
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(e);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const grandCalc = useMemo(() => {
    let qty1=0,qty2=0,qty3=0,qty=0,amt=0,stat=0,comm=0,truck=0,pt=0,exp=0,net=0,tnet=0;
    filtered.forEach(e => (e.rows??[]).forEach(r => {
      const c = calcRow(r as any, settings);
      qty1+=Number(r.qty1);qty2+=Number(r.qty2);qty3+=Number(r.qty3);
      qty+=Number(r.total_qty);amt+=c.amount;stat+=c.station;comm+=c.commission;
      truck+=c.truck;pt+=c.pt;exp+=c.expenses;net+=c.net;tnet+=c.total_net;
    }));
    return {qty1,qty2,qty3,qty,amt,stat,comm,truck,pt,exp,net,tnet};
  }, [filtered, settings]);

  const thCls = "px-2 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 whitespace-nowrap border-b border-[#30363d]";
  const tdCls = "px-2 py-2 text-xs text-gray-300 whitespace-nowrap";
  const rateClr = "text-blue-400 font-medium";

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="px-4 py-3 flex items-center gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by mark..."
          className="bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 w-52" />
        <div className="flex-1" />
        {selected.size > 0 && (
          <button onClick={() => { if (confirm(`Delete ${selected.size} selected entries?`)) bulkDeleteMut.mutate([...selected]); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/40 hover:bg-red-800/60 border border-red-700 text-red-300 rounded-lg text-xs transition">
            <Trash2 size={13} /> Delete ({selected.size})
          </button>
        )}
        <button onClick={() => setShowFilter(f => !f)}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-[#30363d] text-gray-300 rounded-lg text-xs hover:bg-[#161b22] transition">
          <Filter size={13} /> Filter
        </button>
        <button onClick={exportExcel}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-[#30363d] text-gray-300 rounded-lg text-xs hover:bg-[#161b22] transition">
          <Download size={13} /> Export
        </button>
        <button onClick={() => setModal({ mode: "new" })}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition">
          <Plus size={13} /> New Entry
        </button>
        <button onClick={exportInvoicePDF}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-700 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold transition">
          Invoice PDF
        </button>
      </div>

      {showFilter && (
        <div className="px-4 pb-3 flex items-center gap-4 flex-wrap border-b border-[#30363d]">
          <div>
            <label className="text-xs text-gray-500 block mb-1">From Date</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="bg-[#161b22] border border-[#30363d] rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">To Date</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="bg-[#161b22] border border-[#30363d] rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Payment</label>
            <div className="flex gap-1">
              {(["all","paid","unpaid"] as const).map(v => (
                <button key={v} onClick={() => setPayFilter(v)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${payFilter===v ? "bg-blue-600 text-white" : "bg-[#161b22] border border-[#30363d] text-gray-400 hover:text-white"}`}>
                  {v.charAt(0).toUpperCase()+v.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto px-4 pb-4">
        <table className="w-full border-collapse text-left" style={{ minWidth: "1200px" }}>
          <thead className="sticky top-0 bg-[#0d1117] z-10">
            <tr>
              <th className={thCls + " w-8"}>
                <input type="checkbox" onChange={toggleAll}
                  checked={filtered.length > 0 && filtered.every(e => selected.has(e.id))}
                  className="rounded border-gray-600 bg-[#1c2333]" />
              </th>
              <th className={thCls}>DATE</th>
              <th className={thCls}>MARK</th>
              <th className={thCls}>TRUCK NO</th>
              <th className={thCls + " text-right"}>QTY1<br/><span className="text-gray-600 normal-case">(5kg)</span></th>
              <th className={thCls + " text-blue-400"}>RATE1</th>
              <th className={thCls + " text-right"}>QTY2<br/><span className="text-gray-600 normal-case">(10kg)</span></th>
              <th className={thCls + " text-blue-400"}>RATE2</th>
              <th className={thCls + " text-right"}>QTY3<br/><span className="text-gray-600 normal-case">(15kg)</span></th>
              <th className={thCls + " text-blue-400"}>RATE3</th>
              <th className={thCls + " text-right"}>QTY</th>
              <th className={thCls + " text-right"}>AMOUNT</th>
              <th className={thCls + " text-right"}>STATION</th>
              <th className={thCls + " text-right"}>COMM</th>
              <th className={thCls + " text-right"}>TRUCK</th>
              <th className={thCls + " text-right"}>P&T</th>
              <th className={thCls + " text-red-400 text-right"}>EXPENSES</th>
              <th className={thCls + " text-right"}>NET<br/><span className="text-gray-600 normal-case">/box</span></th>
              <th className={thCls + " text-right"}>TOTAL NET<br/><span className="text-blue-600 normal-case">(+2%)</span></th>
              <th className={thCls}>PAYMENT</th>
              <th className={thCls}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={21} className="text-center py-12 text-gray-500">Loading...</td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={21} className="text-center py-16 text-gray-500">
                No entries found. Click "+ New Entry" to add one.
              </td></tr>
            )}
            {dateGroups.map(([date, dayEntries]) => {
              const dayCalc = { qty1:0,qty2:0,qty3:0,qty:0,amt:0,stat:0,comm:0,truck:0,pt:0,exp:0,net:0,tnet:0 };
              const allDayRows = dayEntries.flatMap(e => (e.rows ?? []).map(r => ({ r, e })));
              allDayRows.forEach(({ r }) => {
                const c = calcRow(r as any, settings);
                dayCalc.qty1+=Number(r.qty1);dayCalc.qty2+=Number(r.qty2);dayCalc.qty3+=Number(r.qty3);
                dayCalc.qty+=Number(r.total_qty);dayCalc.amt+=c.amount;dayCalc.stat+=c.station;
                dayCalc.comm+=c.commission;dayCalc.truck+=c.truck;dayCalc.pt+=c.pt;
                dayCalc.exp+=c.expenses;dayCalc.net+=c.net;dayCalc.tnet+=c.total_net;
              });

              return [
                ...dayEntries.map(entry =>
                  (entry.rows ?? []).map(row => {
                    const c = calcRow(row as any, settings);
                    const totalQty = Number(row.total_qty) || 0;
                    const q1pct = totalQty > 0 ? (Number(row.qty1)/totalQty*100).toFixed(1) : "0";
                    const q2pct = totalQty > 0 ? (Number(row.qty2)/totalQty*100).toFixed(1) : "0";
                    const q3pct = totalQty > 0 ? (Number(row.qty3)/totalQty*100).toFixed(1) : "0";
                    return (
                      <tr key={`${entry.id}-${row.id}`} className="border-t border-[#1c2333] hover:bg-[#161b22] transition">
                        <td className={tdCls}>
                          <input type="checkbox" checked={selected.has(entry.id)} onChange={() => toggleSelect(entry.id)}
                            className="rounded border-gray-600 bg-[#1c2333]" />
                        </td>
                        <td className={tdCls + " text-gray-200"}>{date.split("-").reverse().join("-")}</td>
                        <td className={tdCls}>
                          <span className="bg-blue-900/50 text-blue-300 border border-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">{row.mark}</span>
                        </td>
                        <td className={tdCls}>{row.truck_no || "—"}</td>
                        <td className={tdCls + " text-right"}>
                          <div className="font-medium text-white">{fmtINR(Number(row.qty1), 0)}</div>
                          <div className="text-[10px] text-gray-500">{q1pct}%</div>
                        </td>
                        <td className={tdCls + " " + rateClr}>{Number(row.rate1) > 0 ? fmtINR(Number(row.rate1), 0) : "—"}</td>
                        <td className={tdCls + " text-right"}>
                          <div className="font-medium text-white">{fmtINR(Number(row.qty2), 0)}</div>
                          <div className="text-[10px] text-gray-500">{q2pct}%</div>
                        </td>
                        <td className={tdCls + " " + rateClr}>{Number(row.rate2) > 0 ? fmtINR(Number(row.rate2), 0) : "—"}</td>
                        <td className={tdCls + " text-right"}>
                          <div className="font-medium text-white">{fmtINR(Number(row.qty3), 0)}</div>
                          <div className="text-[10px] text-gray-500">{q3pct}%</div>
                        </td>
                        <td className={tdCls + " " + rateClr}>{Number(row.rate3) > 0 ? fmtINR(Number(row.rate3), 0) : "—"}</td>
                        <td className={tdCls + " text-right font-semibold text-white"}>{fmtINR(totalQty, 0)}</td>
                        <td className={tdCls + " text-right font-semibold text-white"}>{fmtINR(c.amount, 0)}<div className="text-[10px] text-gray-500">{totalQty>0?(c.amount/totalQty).toFixed(0)+"/box":""}</div></td>
                        <td className={tdCls + " text-right"}>{fmtINR(c.station, 0)}<div className="text-[10px] text-gray-500">{settings.station_rate}/box</div></td>
                        <td className={tdCls + " text-right"}>{fmtINR(c.commission, 0)}<div className="text-[10px] text-gray-500">{settings.commission_pct}%</div></td>
                        <td className={tdCls + " text-right"}>{fmtINR(c.truck, 0)}<div className="text-[10px] text-gray-500">{settings.truck_fare}/box</div></td>
                        <td className={tdCls + " text-right"}>{fmtINR(c.pt, 0)}</td>
                        <td className={tdCls + " text-right text-red-400 font-semibold"}>{fmtINR(c.expenses, 0)}</td>
                        <td className={tdCls + " text-right " + (c.net>=0?"text-green-400":"text-red-400") + " font-semibold"}>{fmtINR(c.net, 0)}<div className="text-[10px]">{fmtINR(c.net_per_box, 2)}/box</div></td>
                        <td className={tdCls + " text-right " + (c.total_net>=0?"text-green-400":"text-red-400") + " font-semibold"}>{fmtINR(c.total_net, 0)}<div className="text-[10px]">{fmtINR(c.total_net_per_box, 2)}/box</div></td>
                        <td className={tdCls}>
                          <select value={entry.payment_status}
                            onChange={e => payMut.mutate({ id: entry.id, status: e.target.value })}
                            className={`text-xs px-2 py-1 rounded border focus:outline-none ${entry.payment_status==="paid" ? "bg-green-900/40 border-green-700 text-green-300" : "bg-purple-900/40 border-purple-700 text-purple-300"}`}>
                            <option value="unpaid">Unpaid</option>
                            <option value="paid">Paid</option>
                          </select>
                        </td>
                        <td className={tdCls}>
                          <div className="flex gap-1">
                            <button onClick={() => setModal({ mode: "edit", entry })}
                              className="p-1.5 rounded bg-[#1c2333] hover:bg-blue-900/40 text-gray-400 hover:text-blue-400 transition">
                              <Pencil size={12} />
                            </button>
                            <button onClick={() => { if (confirm("Delete this entry?")) deleteMut.mutate(entry.id); }}
                              className="p-1.5 rounded bg-[#1c2333] hover:bg-red-900/40 text-gray-400 hover:text-red-400 transition">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ),
                <tr key={`subtotal-${date}`} className="border-t border-[#30363d] bg-[#1a1f2e]">
                  <td></td>
                  <td colSpan={3} className="px-2 py-2 text-xs text-gray-400 font-semibold">{date.split("-").reverse().join("-")} TOTALS</td>
                  <td className="px-2 py-2 text-xs text-right text-gray-300 font-semibold">{fmtINR(dayCalc.qty1,0)}<div className="text-[10px] text-gray-500">{dayCalc.qty>0?(dayCalc.qty1/dayCalc.qty*100).toFixed(1):0}%</div></td>
                  <td></td>
                  <td className="px-2 py-2 text-xs text-right text-gray-300 font-semibold">{fmtINR(dayCalc.qty2,0)}<div className="text-[10px] text-gray-500">{dayCalc.qty>0?(dayCalc.qty2/dayCalc.qty*100).toFixed(1):0}%</div></td>
                  <td></td>
                  <td className="px-2 py-2 text-xs text-right text-gray-300 font-semibold">{fmtINR(dayCalc.qty3,0)}<div className="text-[10px] text-gray-500">{dayCalc.qty>0?(dayCalc.qty3/dayCalc.qty*100).toFixed(1):0}%</div></td>
                  <td></td>
                  <td className="px-2 py-2 text-xs text-right text-white font-bold">{fmtINR(dayCalc.qty,0)}</td>
                  <td className="px-2 py-2 text-xs text-right text-white font-bold">{fmtINR(dayCalc.amt,0)}<div className="text-[10px] text-gray-500">{dayCalc.qty>0?(dayCalc.amt/dayCalc.qty*100).toFixed(1):0}% of total</div></td>
                  <td className="px-2 py-2 text-xs text-right text-gray-300">{fmtINR(dayCalc.stat,0)}</td>
                  <td className="px-2 py-2 text-xs text-right text-gray-300">{fmtINR(dayCalc.comm,0)}</td>
                  <td className="px-2 py-2 text-xs text-right text-gray-300">{fmtINR(dayCalc.truck,0)}</td>
                  <td className="px-2 py-2 text-xs text-right text-gray-300">{fmtINR(dayCalc.pt,0)}</td>
                  <td className="px-2 py-2 text-xs text-right text-red-400 font-bold">{fmtINR(dayCalc.exp,0)}</td>
                  <td className={"px-2 py-2 text-xs text-right font-bold " + (dayCalc.net>=0?"text-green-400":"text-red-400")}>{fmtINR(dayCalc.net,0)}</td>
                  <td className={"px-2 py-2 text-xs text-right font-bold " + (dayCalc.tnet>=0?"text-green-400":"text-red-400")}>{fmtINR(dayCalc.tnet,0)}</td>
                  <td colSpan={2}></td>
                </tr>
              ];
            })}

            {filtered.length > 0 && (
              <tr className="border-t-2 border-blue-700 bg-[#0d1528]">
                <td></td>
                <td colSpan={3} className="px-2 py-3 text-xs text-blue-300 font-bold uppercase tracking-wider">GRAND TOTAL</td>
                <td className="px-2 py-3 text-xs text-right text-white font-bold">{fmtINR(grandCalc.qty1,0)}<div className="text-[10px] text-gray-400">{grandCalc.qty>0?(grandCalc.qty1/grandCalc.qty*100).toFixed(1):0}%</div></td>
                <td></td>
                <td className="px-2 py-3 text-xs text-right text-white font-bold">{fmtINR(grandCalc.qty2,0)}<div className="text-[10px] text-gray-400">{grandCalc.qty>0?(grandCalc.qty2/grandCalc.qty*100).toFixed(1):0}%</div></td>
                <td></td>
                <td className="px-2 py-3 text-xs text-right text-white font-bold">{fmtINR(grandCalc.qty3,0)}<div className="text-[10px] text-gray-400">{grandCalc.qty>0?(grandCalc.qty3/grandCalc.qty*100).toFixed(1):0}%</div></td>
                <td></td>
                <td className="px-2 py-3 text-xs text-right text-white font-bold">{fmtINR(grandCalc.qty,0)}</td>
                <td className="px-2 py-3 text-xs text-right text-white font-bold">{fmtINR(grandCalc.amt,0)}<div className="text-[10px] text-gray-400">{grandCalc.qty>0?(grandCalc.amt/grandCalc.qty).toFixed(2)+"/box":""}</div></td>
                <td className="px-2 py-3 text-xs text-right text-gray-200">{fmtINR(grandCalc.stat,0)}</td>
                <td className="px-2 py-3 text-xs text-right text-gray-200">{fmtINR(grandCalc.comm,0)}</td>
                <td className="px-2 py-3 text-xs text-right text-gray-200">{fmtINR(grandCalc.truck,0)}</td>
                <td className="px-2 py-3 text-xs text-right text-gray-200">{fmtINR(grandCalc.pt,0)}</td>
                <td className="px-2 py-3 text-xs text-right text-red-400 font-bold">{fmtINR(grandCalc.exp,0)}</td>
                <td className={"px-2 py-3 text-xs text-right font-bold text-lg " + (grandCalc.net>=0?"text-green-400":"text-red-400")}>{fmtINR(grandCalc.net,0)}<div className="text-[10px]">{grandCalc.qty>0?(grandCalc.net/grandCalc.qty).toFixed(2)+"/box":""}</div></td>
                <td className={"px-2 py-3 text-xs text-right font-bold " + (grandCalc.tnet>=0?"text-green-400":"text-red-400")}>{fmtINR(grandCalc.tnet,0)}<div className="text-[10px]">{grandCalc.qty>0?(grandCalc.tnet/grandCalc.qty).toFixed(2)+"/box":""}</div></td>
                <td colSpan={2}></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <EntryModal
          mode={modal.mode}
          entry={modal.entry}
          settings={settings}
          saving={createMut.isPending || updateMut.isPending}
          onClose={() => setModal(null)}
          onSave={(date, rows) => {
            if (modal.mode === "new") createMut.mutate({ date, rows });
            else if (modal.entry) updateMut.mutate({ id: modal.entry.id, data: { date, rows } });
          }}
        />
      )}
    </div>
  );
}
