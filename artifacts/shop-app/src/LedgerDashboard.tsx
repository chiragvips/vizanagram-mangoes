import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Filter, Download, Plus, Pencil, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import type { LedgerEntry, CalcSettings } from "./types";
import { calcRow, fmtINR } from "./lib/calculations";
import { getEntries, createEntry, updateEntry, deleteEntry, bulkDeleteEntries } from "./lib/api";
import EntryModal from "./components/EntryModal";

interface Props { settings: CalcSettings; }

function formatDateDMY(d: string) { return d.split("-").reverse().join("-"); }

export default function LedgerDashboard({ settings }: Props) {
  const qc = useQueryClient();
  const { data: entries = [], isLoading } = useQuery({ queryKey: ["entries"], queryFn: getEntries });
  const cf = settings.custom_fields ?? [];

  const [showFilter, setShowFilter] = useState(false);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [payFilter, setPayFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [markFilter, setMarkFilter] = useState<Set<string>>(new Set());
  const [showMarkDropdown, setShowMarkDropdown] = useState(false);
  const markDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (markDropdownRef.current && !markDropdownRef.current.contains(e.target as Node)) setShowMarkDropdown(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [modal, setModal] = useState<{ mode: "new" | "edit"; entry?: LedgerEntry } | null>(null);

  // Collect all unique marks for the dropdown filter
  const allMarks = useMemo(() => {
    const marks = new Set<string>();
    entries.forEach(e => (e.rows ?? []).forEach(r => { if (r.mark) marks.add(r.mark); }));
    return Array.from(marks).sort();
  }, [entries]);

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
      if (markFilter.size > 0) {
        const hasMatch = (e.rows ?? []).some(r => markFilter.has(r.mark));
        if (!hasMatch) return false;
      }
      if (search) {
        const s = search.toLowerCase();
        const hasMatch = (e.rows ?? []).some(r => r.mark?.toLowerCase().includes(s));
        if (!hasMatch) return false;
      }
      return true;
    });
  }, [entries, fromDate, toDate, payFilter, markFilter, search]);

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
        const base: any = {
          Date: entry.date,
          Mark: row.mark,
          "Truck No": row.truck_no,
          "Submark 1": row.submark1 || "",
          "QTY1 (5kg)": Number(row.qty1),
          RATE1: Number(row.rate1),
          "Submark 2": row.submark2 || "",
          "QTY2 (10kg)": Number(row.qty2),
          RATE2: Number(row.rate2),
          "Submark 3": row.submark3 || "",
          "QTY3 (15kg)": Number(row.qty3),
          RATE3: Number(row.rate3),
          "Total QTY": Number(row.total_qty),
          Amount: c.amount,
          Station: c.station,
          Commission: c.commission,
          Truck: c.truck,
          "P&T": c.pt,
        };
        cf.forEach(field => { base[field.name] = c.customValues[field.name] ?? 0; });
        base.Expenses = c.expenses;
        base.Net = c.net;
        base["Net/Box"] = c.net_per_box;
        base["Total Net"] = c.total_net;
        base.Payment = entry.payment_status;
        allRows.push(base);
      });
    });
    const ws = XLSX.utils.json_to_sheet(allRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ledger");
    XLSX.writeFile(wb, "Vizianagram_Mangoes_Ledger.xlsx");
  }

  function exportInvoicePDF() {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    let y = 15;

    const sep70 = "=".repeat(72);
    const sep50 = "-".repeat(72);

    // COMPANY HEADER
    doc.setFontSize(15); doc.setFont("helvetica", "bold"); doc.setTextColor(0, 0, 0);
    doc.text("GANGARAM MUL CHAND & CO", W / 2, y, { align: "center" });
    y += 6;
    doc.setFontSize(8.5); doc.setFont("helvetica", "normal");
    doc.text("B-153, New Subzi Mandi, Azadpur Delhi - 110 033", W / 2, y, { align: "center" });
    y += 5;
    doc.text("PH: (+91) 9313 80615", W / 2, y, { align: "center" });
    y += 4;
    doc.setFontSize(7); doc.text(sep70, W / 2, y, { align: "center" }); y += 5;

    // BILL INFO
    const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "2-digit" });
    const totalPkgs = filtered.reduce((s, e) => s + (e.rows ?? []).reduce((r, row) => r + Number(row.total_qty), 0), 0);
    const allTrucks = [...new Set(filtered.flatMap(e => (e.rows ?? []).map(r => r.truck_no).filter(Boolean)))];
    const billNo = String(filtered.length > 0 ? filtered[0].id : 1).padStart(6, "0");
    const growerNames = [...new Set(filtered.map(e => e.grower_name).filter(Boolean))];
    const growerLabel = growerNames.length > 0 ? `M/s ${growerNames.join(", ")} - Vizianagram` : "M/s Vizianagram";

    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(growerLabel, 10, y);
    doc.setFont("helvetica", "bold"); doc.text("VATAK", W / 2, y, { align: "center" });
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.text(`Bill No: ${billNo}`, W - 10, y - 5, { align: "right" });
    doc.text(`Prgs: ${fmtINR(totalPkgs, 0)}`, W - 10, y, { align: "right" });
    y += 5;
    doc.text(`Veh: ${allTrucks.slice(0, 3).join(", ") || "—"}`, 10, y);
    doc.text(`Date: ${today} (Purchasing)`, W - 10, y, { align: "right" });
    y += 4;

    // DESCRIPTIONS (from entries)
    const descriptions = filtered.map(e => e.description).filter(Boolean);
    if (descriptions.length > 0) {
      y += 3;
      doc.setFontSize(8.5); doc.setFont("helvetica", "italic");
      descriptions.forEach(desc => {
        if (y > 270) { doc.addPage(); y = 15; }
        doc.text(`Note: ${desc}`, 10, y);
        y += 4;
      });
      doc.setFont("helvetica", "normal");
    }

    doc.setFontSize(7); doc.text(sep70, W / 2, y, { align: "center" }); y += 5;

    // TABLE HEADER
    const C = { sl: 10, desc: 18, qty: 108, rate: 135, amt: 163, exp: 182, net: 200 };
    doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.text("SL", C.sl, y);
    doc.text("Description", C.desc, y);
    doc.text("Quantity", C.qty, y, { align: "right" });
    doc.text("Rate", C.rate, y, { align: "right" });
    doc.text("Amount", C.amt, y, { align: "right" });
    doc.text("Expense", C.exp, y, { align: "right" });
    doc.text("Amount", C.net, y, { align: "right" });
    y += 3;
    doc.setFontSize(7); doc.text(sep50, W / 2, y, { align: "center" }); y += 5;

    // ROWS
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    let sl = 1, gAmt = 0, gExp = 0, gNet = 0, gQty = 0;
    filtered.forEach(entry => {
      (entry.rows ?? []).forEach(row => {
        if (y > 250) { doc.addPage(); y = 15; }
        const c = calcRow(row as any, settings);
        gAmt += c.amount; gExp += c.expenses; gNet += c.net; gQty += Number(row.total_qty);
        const avgRate = Number(row.total_qty) > 0 ? c.amount / Number(row.total_qty) : 0;
        // Build description with submarks
        const subs = [row.submark1, row.submark2, row.submark3].filter(Boolean);
        const descText = subs.length > 0 ? `${row.mark} (${subs.join(", ")})` : row.mark;
        doc.text(String(sl++), C.sl, y);
        doc.text(descText.slice(0, 36), C.desc, y);
        doc.text(fmtINR(Number(row.total_qty), 2), C.qty, y, { align: "right" });
        doc.text(fmtINR(avgRate, 2), C.rate, y, { align: "right" });
        doc.text(fmtINR(c.amount, 2), C.amt, y, { align: "right" });
        doc.text(fmtINR(c.expenses, 2), C.exp, y, { align: "right" });
        doc.text(fmtINR(c.net, 2), C.net, y, { align: "right" });
        y += 7;
      });
    });

    // TOTALS
    y += 2;
    doc.setFontSize(7); doc.text(sep50, W / 2, y, { align: "center" }); y += 5;
    doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.text("Total Gross", C.sl, y);
    doc.text(fmtINR(gQty, 2), C.qty, y, { align: "right" });
    doc.text(fmtINR(gAmt, 2), C.amt, y, { align: "right" });
    y += 7;
    doc.setFontSize(7); doc.text(sep50, W / 2, y, { align: "center" }); y += 5;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text("Total Expenses", C.sl, y);
    doc.text(`-${fmtINR(gExp, 2)}`, C.net, y, { align: "right" });
    y += 7;
    doc.text("Gross", C.sl, y);
    doc.text(fmtINR(gAmt, 2), C.net, y, { align: "right" });
    y += 7;
    doc.setFont("helvetica", "bold");
    doc.text("Net", C.sl, y);
    doc.text(fmtINR(gNet, 2), C.net, y, { align: "right" });
    y += 5;
    doc.setFontSize(7); doc.text(sep70, W / 2, y, { align: "center" }); y += 8;

    // FOOTER
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.text("E.&O.E.", C.sl, y); y += 5;
    doc.text("All disputes subject to Delhi Jurisdiction only.", C.sl, y); y += 5;
    doc.text("We are not responsible for damage/shortage in weight/contents.", C.sl, y); y += 5;
    doc.text("Expenses have been charged according to our shop.", C.sl, y); y += 12;
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text("For GANGARAM MULCHAND & CO", W - 10, y, { align: "right" });

    doc.save("GXM_Invoice.pdf");
  }

  const dateGroups = useMemo(() => {
    const map = new Map<string, LedgerEntry[]>();
    filtered.forEach(e => {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date)!.push(e);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const grandCalc = useMemo(() => {
    let qty1=0,qty2=0,qty3=0,qty=0,amt=0,stat=0,comm=0,truck=0,pt=0,exp=0,net=0,tnet=0;
    const customTotals: Record<string, number> = {};
    cf.forEach(f => { customTotals[f.name] = 0; });
    filtered.forEach(e => (e.rows??[]).forEach(r => {
      const c = calcRow(r as any, settings);
      qty1+=Number(r.qty1);qty2+=Number(r.qty2);qty3+=Number(r.qty3);
      qty+=Number(r.total_qty);amt+=c.amount;stat+=c.station;comm+=c.commission;
      truck+=c.truck;pt+=c.pt;exp+=c.expenses;net+=c.net;tnet+=c.total_net;
      cf.forEach(f => { customTotals[f.name] = (customTotals[f.name] ?? 0) + (c.customValues[f.name] ?? 0); });
    }));
    return {qty1,qty2,qty3,qty,amt,stat,comm,truck,pt,exp,net,tnet,customTotals};
  }, [filtered, settings]);

  const totalCols = 24 + cf.length;

  const thCls = "px-2 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap border-b border-gray-200 dark:border-[#30363d]";
  const tdCls = "px-2 py-2 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap";

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by mark..."
          className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] rounded-lg px-3 py-1.5 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500 w-52" />
        <div className="flex-1" />
        {selected.size > 0 && (
          <button onClick={() => { if (confirm(`Delete ${selected.size} selected entries?`)) bulkDeleteMut.mutate([...selected]); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-900/40 hover:bg-red-100 dark:hover:bg-red-800/60 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-300 rounded-lg text-xs transition">
            <Trash2 size={13} /> Delete ({selected.size})
          </button>
        )}
        <button onClick={() => setShowFilter(f => !f)}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 dark:border-[#30363d] text-gray-600 dark:text-gray-300 rounded-lg text-xs hover:bg-gray-100 dark:hover:bg-[#161b22] transition">
          <Filter size={13} /> Filter
        </button>
        <button onClick={exportExcel}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 dark:border-[#30363d] text-gray-600 dark:text-gray-300 rounded-lg text-xs hover:bg-gray-100 dark:hover:bg-[#161b22] transition">
          <Download size={13} /> Export
        </button>
        <button onClick={() => setModal({ mode: "new" })}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition">
          <Plus size={13} /> New Entry
        </button>
        <button onClick={exportInvoicePDF}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-semibold transition">
          Invoice PDF
        </button>
      </div>

      {showFilter && (
        <div className="px-4 pb-3 flex items-center gap-4 flex-wrap border-b border-gray-200 dark:border-[#30363d]">
          <div>
            <label className="text-xs text-gray-500 block mb-1">From Date</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] rounded px-2 py-1 text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">To Date</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] rounded px-2 py-1 text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:border-blue-500" />
          </div>
          <div className="relative" ref={markDropdownRef}>
            <label className="text-xs text-gray-500 block mb-1">Mark {markFilter.size > 0 && <span className="text-blue-500">({markFilter.size})</span>}</label>
            <button onClick={() => setShowMarkDropdown(v => !v)}
              className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] rounded px-2 py-1 text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:border-blue-500 min-w-[140px] text-left flex items-center justify-between gap-2">
              <span>{markFilter.size === 0 ? "All Marks" : `${markFilter.size} selected`}</span>
              <span className="text-gray-400">▾</span>
            </button>
            {showMarkDropdown && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] rounded-lg shadow-lg max-h-48 overflow-y-auto min-w-[160px]">
                {allMarks.length === 0 && <div className="px-3 py-2 text-xs text-gray-400">No marks</div>}
                {allMarks.map(m => (
                  <label key={m} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-[#1c2333] cursor-pointer text-xs text-gray-800 dark:text-gray-200">
                    <input type="checkbox" checked={markFilter.has(m)}
                      onChange={() => setMarkFilter(prev => { const n = new Set(prev); if (n.has(m)) n.delete(m); else n.add(m); return n; })}
                      className="rounded border-gray-300 dark:border-gray-600" />
                    {m}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Payment</label>
            <div className="flex gap-1">
              {(["all","paid","unpaid"] as const).map(v => (
                <button key={v} onClick={() => setPayFilter(v)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${payFilter===v ? "bg-blue-600 text-white" : "bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"}`}>
                  {v.charAt(0).toUpperCase()+v.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">&nbsp;</label>
            <button onClick={() => { setFromDate(""); setToDate(""); setPayFilter("all"); setMarkFilter(new Set()); setSearch(""); setShowMarkDropdown(false); }}
              className="px-3 py-1 rounded-full text-xs font-medium bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-800/50 transition">
              Reset All
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto px-4 pb-4">
        <table className="w-full border-collapse text-left" style={{ minWidth: `${1440 + cf.length * 90}px` }}>
          <thead className="sticky top-0 bg-gray-50 dark:bg-[#0d1117] z-10">
            <tr>
              <th className={thCls + " w-8"}>
                <input type="checkbox" onChange={toggleAll}
                  checked={filtered.length > 0 && filtered.every(e => selected.has(e.id))}
                  className="rounded border-gray-300 dark:border-gray-600" />
              </th>
              <th className={thCls}>DATE</th>
              <th className={thCls}>MARK</th>
              <th className={thCls}>TRUCK NO</th>
              <th className={thCls + " text-orange-500 dark:text-orange-400"}>SUB 1</th>
              <th className={thCls + " text-right"}>QTY1<br/><span className="text-gray-400 dark:text-gray-600 normal-case">(5kg)</span></th>
              <th className={thCls + " text-blue-500 dark:text-blue-400"}>RATE1</th>
              <th className={thCls + " text-orange-500 dark:text-orange-400"}>SUB 2</th>
              <th className={thCls + " text-right"}>QTY2<br/><span className="text-gray-400 dark:text-gray-600 normal-case">(10kg)</span></th>
              <th className={thCls + " text-blue-500 dark:text-blue-400"}>RATE2</th>
              <th className={thCls + " text-orange-500 dark:text-orange-400"}>SUB 3</th>
              <th className={thCls + " text-right"}>QTY3<br/><span className="text-gray-400 dark:text-gray-600 normal-case">(15kg)</span></th>
              <th className={thCls + " text-blue-500 dark:text-blue-400"}>RATE3</th>
              <th className={thCls + " text-right"}>QTY</th>
              <th className={thCls + " text-right"}>AMOUNT</th>
              <th className={thCls + " text-right"}>STATION</th>
              <th className={thCls + " text-right"}>COMM</th>
              <th className={thCls + " text-right"}>TRUCK</th>
              <th className={thCls + " text-right"}>P&amp;T</th>
              {cf.map(f => (
                <th key={f.name} className={thCls + " text-right text-purple-500 dark:text-purple-400"}>
                  {f.name.toUpperCase()}<br/><span className="text-gray-400 dark:text-gray-600 normal-case">{f.per_unit ? "/box" : "flat"}</span>
                </th>
              ))}
              <th className={thCls + " text-red-500 dark:text-red-400 text-right"}>EXPENSES</th>
              <th className={thCls + " text-right"}>NET<br/><span className="text-gray-400 dark:text-gray-600 normal-case">/box</span></th>
              <th className={thCls + " text-right"}>TOTAL NET<br/><span className="text-blue-500 dark:text-blue-600 normal-case">(+2%)</span></th>
              <th className={thCls}>PAYMENT</th>
              <th className={thCls}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={totalCols} className="text-center py-12 text-gray-400 dark:text-gray-500">Loading...</td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={totalCols} className="text-center py-16 text-gray-400 dark:text-gray-500">
                No entries found. Click &quot;+ New Entry&quot; to add one.
              </td></tr>
            )}
            {dateGroups.map(([date, dayEntries]) => {
              const dc: any = { qty1:0,qty2:0,qty3:0,qty:0,amt:0,stat:0,comm:0,truck:0,pt:0,exp:0,net:0,tnet:0,customTotals:{} as Record<string,number> };
              cf.forEach(f => { dc.customTotals[f.name] = 0; });
              dayEntries.flatMap(e => (e.rows ?? []).map(r => ({ r, e }))).forEach(({ r }) => {
                const c = calcRow(r as any, settings);
                dc.qty1+=Number(r.qty1);dc.qty2+=Number(r.qty2);dc.qty3+=Number(r.qty3);
                dc.qty+=Number(r.total_qty);dc.amt+=c.amount;dc.stat+=c.station;
                dc.comm+=c.commission;dc.truck+=c.truck;dc.pt+=c.pt;
                dc.exp+=c.expenses;dc.net+=c.net;dc.tnet+=c.total_net;
                cf.forEach(f => { dc.customTotals[f.name] = (dc.customTotals[f.name] ?? 0) + (c.customValues[f.name] ?? 0); });
              });

              return [
                ...dayEntries.map(entry => {
                  const entryRows = entry.rows ?? [];
                  return entryRows.map((row, rowIdx) => {
                    const isFirstRow = rowIdx === 0;
                    const rowCount = entryRows.length;
                    const c = calcRow(row as any, settings);
                    const totalQty = Number(row.total_qty) || 0;
                    const q1pct = totalQty > 0 ? (Number(row.qty1)/totalQty*100).toFixed(1) : "0";
                    const q2pct = totalQty > 0 ? (Number(row.qty2)/totalQty*100).toFixed(1) : "0";
                    const q3pct = totalQty > 0 ? (Number(row.qty3)/totalQty*100).toFixed(1) : "0";
                    return (
                      <tr key={`${entry.id}-${row.id}`} className={`border-t hover:bg-gray-50 dark:hover:bg-[#161b22] transition ${isFirstRow ? "border-gray-200 dark:border-[#30363d]" : "border-gray-100 dark:border-[#1c2333]"} ${!isFirstRow ? "bg-gray-50/30 dark:bg-[#0d1117]/50" : ""}`}>
                        <td className={tdCls}>
                          {isFirstRow && <input type="checkbox" checked={selected.has(entry.id)} onChange={() => toggleSelect(entry.id)}
                            className="rounded border-gray-300 dark:border-gray-600" />}
                        </td>
                        <td className={tdCls + " text-gray-800 dark:text-gray-200"}>
                          {isFirstRow ? formatDateDMY(date) : <span className="text-gray-300 dark:text-gray-600 text-[10px]">#{entry.id}</span>}
                        </td>
                        <td className={tdCls}>
                          <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">{row.mark}</span>
                        </td>
                        <td className={tdCls}>{row.truck_no || "—"}</td>
                        <td className={tdCls + " text-orange-600 dark:text-orange-400 text-[10px] font-medium"}>{row.submark1 || "—"}</td>
                        <td className={tdCls + " text-right"}>
                          <div className="font-medium text-gray-900 dark:text-white">{fmtINR(Number(row.qty1), 0)}</div>
                          <div className="text-[10px] text-gray-400 dark:text-gray-500">{q1pct}%</div>
                        </td>
                        <td className={tdCls + " text-blue-600 dark:text-blue-400 font-medium"}>{Number(row.rate1) > 0 ? fmtINR(Number(row.rate1), 0) : "—"}</td>
                        <td className={tdCls + " text-orange-600 dark:text-orange-400 text-[10px] font-medium"}>{row.submark2 || "—"}</td>
                        <td className={tdCls + " text-right"}>
                          <div className="font-medium text-gray-900 dark:text-white">{fmtINR(Number(row.qty2), 0)}</div>
                          <div className="text-[10px] text-gray-400 dark:text-gray-500">{q2pct}%</div>
                        </td>
                        <td className={tdCls + " text-blue-600 dark:text-blue-400 font-medium"}>{Number(row.rate2) > 0 ? fmtINR(Number(row.rate2), 0) : "—"}</td>
                        <td className={tdCls + " text-orange-600 dark:text-orange-400 text-[10px] font-medium"}>{row.submark3 || "—"}</td>
                        <td className={tdCls + " text-right"}>
                          <div className="font-medium text-gray-900 dark:text-white">{fmtINR(Number(row.qty3), 0)}</div>
                          <div className="text-[10px] text-gray-400 dark:text-gray-500">{q3pct}%</div>
                        </td>
                        <td className={tdCls + " text-blue-600 dark:text-blue-400 font-medium"}>{Number(row.rate3) > 0 ? fmtINR(Number(row.rate3), 0) : "—"}</td>
                        <td className={tdCls + " text-right font-semibold text-gray-900 dark:text-white"}>{fmtINR(totalQty, 0)}</td>
                        <td className={tdCls + " text-right font-semibold text-gray-900 dark:text-white"}>
                          {fmtINR(c.amount, 0)}
                          <div className="text-[10px] text-gray-400 dark:text-gray-500">{totalQty>0?(c.amount/totalQty).toFixed(0)+"/box":""}</div>
                        </td>
                        <td className={tdCls + " text-right"}>
                          {fmtINR(c.station, 0)}
                          <div className="text-[10px] text-gray-400 dark:text-gray-500">{settings.station_rate}/box</div>
                        </td>
                        <td className={tdCls + " text-right"}>
                          {fmtINR(c.commission, 0)}
                          <div className="text-[10px] text-gray-400 dark:text-gray-500">{settings.commission_pct}%</div>
                        </td>
                        <td className={tdCls + " text-right"}>
                          {fmtINR(c.truck, 0)}
                          <div className="text-[10px] text-gray-400 dark:text-gray-500">{settings.truck_fare}/box</div>
                        </td>
                        <td className={tdCls + " text-right"}>{fmtINR(c.pt, 0)}</td>
                        {cf.map(f => (
                          <td key={f.name} className={tdCls + " text-right text-purple-600 dark:text-purple-400"}>
                            {fmtINR(c.customValues[f.name] ?? 0, 0)}
                            <div className="text-[10px] text-gray-400 dark:text-gray-500">{f.per_unit ? `${f.default_value}/box` : "flat"}</div>
                          </td>
                        ))}
                        <td className={tdCls + " text-right text-red-500 dark:text-red-400 font-semibold"}>{fmtINR(c.expenses, 0)}</td>
                        <td className={tdCls + " text-right font-semibold " + (c.net>=0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400")}>
                          {fmtINR(c.net, 0)}
                          <div className="text-[10px]">{fmtINR(c.net_per_box, 2)}/box</div>
                        </td>
                        <td className={tdCls + " text-right font-semibold " + (c.total_net>=0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400")}>
                          {fmtINR(c.total_net, 0)}
                          <div className="text-[10px]">{fmtINR(c.total_net_per_box, 2)}/box</div>
                        </td>
                        <td className={tdCls}>
                          {isFirstRow ? (
                            <select value={entry.payment_status}
                              onChange={e => payMut.mutate({ id: entry.id, status: e.target.value })}
                              className={`text-xs px-2 py-1 rounded border focus:outline-none ${entry.payment_status==="paid" ? "bg-green-50 dark:bg-green-900/40 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300" : "bg-purple-50 dark:bg-purple-900/40 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300"}`}>
                              <option value="unpaid">Unpaid</option>
                              <option value="paid">Paid</option>
                            </select>
                          ) : (
                            <span className="text-[10px] text-gray-400 dark:text-gray-600">{rowCount} rows</span>
                          )}
                        </td>
                        <td className={tdCls}>
                          {isFirstRow && (
                            <div className="flex gap-1">
                              <button onClick={() => setModal({ mode: "edit", entry })}
                                className="p-1.5 rounded bg-gray-100 dark:bg-[#1c2333] hover:bg-blue-100 dark:hover:bg-blue-900/40 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition">
                                <Pencil size={12} />
                              </button>
                              <button onClick={() => { if (confirm("Delete this entry?")) deleteMut.mutate(entry.id); }}
                                className="p-1.5 rounded bg-gray-100 dark:bg-[#1c2333] hover:bg-red-100 dark:hover:bg-red-900/40 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  });
                }),
                <tr key={`subtotal-${date}`} className="border-t border-gray-300 dark:border-[#30363d] bg-blue-50 dark:bg-[#1a1f2e]">
                  <td></td>
                  <td colSpan={3} className="px-2 py-2 text-xs text-gray-500 dark:text-gray-400 font-semibold">{formatDateDMY(date)} TOTALS</td>
                  <td></td>
                  <td className="px-2 py-2 text-xs text-right text-gray-700 dark:text-gray-300 font-semibold">{fmtINR(dc.qty1,0)}<div className="text-[10px] text-gray-400">{dc.qty>0?(dc.qty1/dc.qty*100).toFixed(1):0}%</div></td>
                  <td></td>
                  <td></td>
                  <td className="px-2 py-2 text-xs text-right text-gray-700 dark:text-gray-300 font-semibold">{fmtINR(dc.qty2,0)}<div className="text-[10px] text-gray-400">{dc.qty>0?(dc.qty2/dc.qty*100).toFixed(1):0}%</div></td>
                  <td></td>
                  <td></td>
                  <td className="px-2 py-2 text-xs text-right text-gray-700 dark:text-gray-300 font-semibold">{fmtINR(dc.qty3,0)}<div className="text-[10px] text-gray-400">{dc.qty>0?(dc.qty3/dc.qty*100).toFixed(1):0}%</div></td>
                  <td></td>
                  <td className="px-2 py-2 text-xs text-right text-gray-900 dark:text-white font-bold">{fmtINR(dc.qty,0)}</td>
                  <td className="px-2 py-2 text-xs text-right text-gray-900 dark:text-white font-bold">{fmtINR(dc.amt,0)}<div className="text-[10px] text-gray-400">{dc.qty>0?(dc.amt/dc.qty).toFixed(2)+"/box":""}</div></td>
                  <td className="px-2 py-2 text-xs text-right text-gray-600 dark:text-gray-300">{fmtINR(dc.stat,0)}<div className="text-[10px] text-gray-400">{dc.amt>0?(dc.stat/dc.amt*100).toFixed(1):0}%</div></td>
                  <td className="px-2 py-2 text-xs text-right text-gray-600 dark:text-gray-300">{fmtINR(dc.comm,0)}<div className="text-[10px] text-gray-400">{dc.amt>0?(dc.comm/dc.amt*100).toFixed(1):0}%</div></td>
                  <td className="px-2 py-2 text-xs text-right text-gray-600 dark:text-gray-300">{fmtINR(dc.truck,0)}<div className="text-[10px] text-gray-400">{dc.amt>0?(dc.truck/dc.amt*100).toFixed(1):0}%</div></td>
                  <td className="px-2 py-2 text-xs text-right text-gray-600 dark:text-gray-300">{fmtINR(dc.pt,0)}<div className="text-[10px] text-gray-400">{dc.amt>0?(dc.pt/dc.amt*100).toFixed(1):0}%</div></td>
                  {cf.map(f => (
                    <td key={f.name} className="px-2 py-2 text-xs text-right text-purple-600 dark:text-purple-400 font-semibold">{fmtINR(dc.customTotals[f.name]??0,0)}<div className="text-[10px] text-gray-400">{dc.amt>0?((dc.customTotals[f.name]??0)/dc.amt*100).toFixed(1):0}%</div></td>
                  ))}
                  <td className="px-2 py-2 text-xs text-right text-red-500 dark:text-red-400 font-bold">{fmtINR(dc.exp,0)}<div className="text-[10px] text-gray-400">{dc.amt>0?(dc.exp/dc.amt*100).toFixed(1):0}%</div></td>
                  <td className={"px-2 py-2 text-xs text-right font-bold " + (dc.net>=0?"text-green-600 dark:text-green-400":"text-red-500 dark:text-red-400")}>{fmtINR(dc.net,0)}<div className="text-[10px]">{dc.qty>0?(dc.net/dc.qty).toFixed(2)+"/box":""}</div></td>
                  <td className={"px-2 py-2 text-xs text-right font-bold " + (dc.tnet>=0?"text-green-600 dark:text-green-400":"text-red-500 dark:text-red-400")}>{fmtINR(dc.tnet,0)}<div className="text-[10px]">{dc.qty>0?(dc.tnet/dc.qty).toFixed(2)+"/box":""}</div></td>
                  <td colSpan={2}></td>
                </tr>
              ];
            })}

            {filtered.length > 0 && (
              <tr className="border-t-2 border-blue-500 dark:border-blue-700 bg-blue-100 dark:bg-[#0d1528]">
                <td></td>
                <td colSpan={3} className="px-2 py-3 text-xs text-blue-600 dark:text-blue-300 font-bold uppercase tracking-wider">GRAND TOTAL</td>
                <td></td>
                <td className="px-2 py-3 text-xs text-right text-gray-900 dark:text-white font-bold">{fmtINR(grandCalc.qty1,0)}<div className="text-[10px] text-gray-500">{grandCalc.qty>0?(grandCalc.qty1/grandCalc.qty*100).toFixed(1):0}%</div></td>
                <td></td>
                <td></td>
                <td className="px-2 py-3 text-xs text-right text-gray-900 dark:text-white font-bold">{fmtINR(grandCalc.qty2,0)}<div className="text-[10px] text-gray-500">{grandCalc.qty>0?(grandCalc.qty2/grandCalc.qty*100).toFixed(1):0}%</div></td>
                <td></td>
                <td></td>
                <td className="px-2 py-3 text-xs text-right text-gray-900 dark:text-white font-bold">{fmtINR(grandCalc.qty3,0)}<div className="text-[10px] text-gray-500">{grandCalc.qty>0?(grandCalc.qty3/grandCalc.qty*100).toFixed(1):0}%</div></td>
                <td></td>
                <td className="px-2 py-3 text-xs text-right text-gray-900 dark:text-white font-bold">{fmtINR(grandCalc.qty,0)}</td>
                <td className="px-2 py-3 text-xs text-right text-gray-900 dark:text-white font-bold">{fmtINR(grandCalc.amt,0)}<div className="text-[10px] text-gray-400">{grandCalc.qty>0?(grandCalc.amt/grandCalc.qty).toFixed(2)+"/box":""}</div></td>
                <td className="px-2 py-3 text-xs text-right text-gray-700 dark:text-gray-200">{fmtINR(grandCalc.stat,0)}<div className="text-[10px] text-gray-400">{grandCalc.amt>0?(grandCalc.stat/grandCalc.amt*100).toFixed(1):0}%</div></td>
                <td className="px-2 py-3 text-xs text-right text-gray-700 dark:text-gray-200">{fmtINR(grandCalc.comm,0)}<div className="text-[10px] text-gray-400">{grandCalc.amt>0?(grandCalc.comm/grandCalc.amt*100).toFixed(1):0}%</div></td>
                <td className="px-2 py-3 text-xs text-right text-gray-700 dark:text-gray-200">{fmtINR(grandCalc.truck,0)}<div className="text-[10px] text-gray-400">{grandCalc.amt>0?(grandCalc.truck/grandCalc.amt*100).toFixed(1):0}%</div></td>
                <td className="px-2 py-3 text-xs text-right text-gray-700 dark:text-gray-200">{fmtINR(grandCalc.pt,0)}<div className="text-[10px] text-gray-400">{grandCalc.amt>0?(grandCalc.pt/grandCalc.amt*100).toFixed(1):0}%</div></td>
                {cf.map(f => (
                  <td key={f.name} className="px-2 py-3 text-xs text-right text-purple-600 dark:text-purple-400 font-bold">{fmtINR(grandCalc.customTotals[f.name]??0,0)}<div className="text-[10px] text-gray-400">{grandCalc.amt>0?((grandCalc.customTotals[f.name]??0)/grandCalc.amt*100).toFixed(1):0}%</div></td>
                ))}
                <td className="px-2 py-3 text-xs text-right text-red-500 dark:text-red-400 font-bold">{fmtINR(grandCalc.exp,0)}<div className="text-[10px] text-gray-400">{grandCalc.amt>0?(grandCalc.exp/grandCalc.amt*100).toFixed(1):0}%</div></td>
                <td className={"px-2 py-3 text-xs text-right font-bold text-base " + (grandCalc.net>=0?"text-green-600 dark:text-green-400":"text-red-500 dark:text-red-400")}>
                  {fmtINR(grandCalc.net,0)}
                  <div className="text-[10px]">{grandCalc.qty>0?(grandCalc.net/grandCalc.qty).toFixed(2)+"/box":""}</div>
                </td>
                <td className={"px-2 py-3 text-xs text-right font-bold " + (grandCalc.tnet>=0?"text-green-600 dark:text-green-400":"text-red-500 dark:text-red-400")}>
                  {fmtINR(grandCalc.tnet,0)}
                  <div className="text-[10px]">{grandCalc.qty>0?(grandCalc.tnet/grandCalc.qty).toFixed(2)+"/box":""}</div>
                </td>
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
          onSave={(date, description, grower_name, rows) => {
            if (modal.mode === "new") createMut.mutate({ date, description, grower_name, rows });
            else if (modal.entry) updateMut.mutate({ id: modal.entry.id, data: { date, description, grower_name, rows } });
          }}
        />
      )}
    </div>
  );
}
