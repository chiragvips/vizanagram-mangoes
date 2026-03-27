import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Plus, Trash2, FileSpreadsheet, FileText, Save, X, Pencil } from "lucide-react";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";

const queryClient = new QueryClient();

const COMPANY_NAME = "GangaRam Mulchaand and Sons";
const API_BASE = "/api";

type Transaction = {
  id: number;
  date: string;
  description: string;
  partyName: string | null;
  quantity: string | null;
  rate: string | null;
  amount: string;
  transactionType: string | null;
  notes: string | null;
  createdAt: string | null;
};

type TransactionInput = {
  date: string;
  description: string;
  partyName: string;
  quantity: string;
  rate: string;
  amount: string;
  transactionType: string;
  notes: string;
};

async function fetchTransactions(): Promise<Transaction[]> {
  const res = await fetch(`${API_BASE}/transactions`);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

async function createTransaction(data: TransactionInput): Promise<Transaction> {
  const res = await fetch(`${API_BASE}/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create");
  return res.json();
}

async function updateTransaction(id: number, data: Partial<TransactionInput>): Promise<Transaction> {
  const res = await fetch(`${API_BASE}/transactions/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update");
  return res.json();
}

async function deleteTransaction(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/transactions/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete");
}

function emptyInput(): TransactionInput {
  return {
    date: new Date().toISOString().split("T")[0],
    description: "",
    partyName: "",
    quantity: "",
    rate: "",
    amount: "",
    transactionType: "entry",
    notes: "",
  };
}

function formatCurrency(val: string | number | null): string {
  if (val === null || val === "") return "—";
  const n = Number(val);
  if (isNaN(n)) return "—";
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function MainApp() {
  const qc = useQueryClient();
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: fetchTransactions,
  });

  const createMut = useMutation({
    mutationFn: createTransaction,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transactions"] }); setAddOpen(false); setForm(emptyInput()); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<TransactionInput> }) => updateTransaction(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transactions"] }); setEditId(null); },
  });

  const deleteMut = useMutation({
    mutationFn: deleteTransaction,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transactions"] }),
  });

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<TransactionInput>(emptyInput());
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<TransactionInput>(emptyInput());

  const grandTotal = transactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);

  function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.description || !form.date || !form.amount) return;
    createMut.mutate(form);
  }

  function startEdit(t: Transaction) {
    setEditId(t.id);
    setEditForm({
      date: t.date,
      description: t.description,
      partyName: t.partyName ?? "",
      quantity: t.quantity ?? "",
      rate: t.rate ?? "",
      amount: t.amount,
      transactionType: t.transactionType ?? "entry",
      notes: t.notes ?? "",
    });
  }

  function handleEditSubmit(id: number) {
    updateMut.mutate({ id, data: editForm });
  }

  function exportExcel() {
    const rows = transactions.map((t, i) => ({
      "S.No": i + 1,
      "Date": t.date,
      "Description": t.description,
      "Party Name": t.partyName ?? "",
      "Qty": t.quantity ?? "",
      "Rate (₹)": t.rate ?? "",
      "Amount (₹)": Number(t.amount),
      "Type": t.transactionType ?? "",
      "Notes": t.notes ?? "",
    }));
    rows.push({
      "S.No": "" as any,
      "Date": "",
      "Description": "GRAND TOTAL",
      "Party Name": "",
      "Qty": "",
      "Rate (₹)": "",
      "Amount (₹)": grandTotal,
      "Type": "",
      "Notes": "",
    });

    const ws = XLSX.utils.json_to_sheet(rows);

    ws["!cols"] = [
      { wch: 5 }, { wch: 12 }, { wch: 30 }, { wch: 20 },
      { wch: 8 }, { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 20 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ledger");
    XLSX.writeFile(wb, `${COMPANY_NAME}_Ledger.xlsx`);
  }

  function exportInvoicePDF() {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 15;

    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 80, 180);
    doc.text(COMPANY_NAME, pageW / 2, y, { align: "center" });
    y += 7;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("Invoice / Ledger Statement", pageW / 2, y, { align: "center" });
    y += 5;

    doc.setDrawColor(30, 80, 180);
    doc.setLineWidth(0.5);
    doc.line(15, y, pageW - 15, y);
    y += 5;

    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
    doc.text(`Date: ${today}`, pageW - 15, y, { align: "right" });
    y += 8;

    const colX = [15, 25, 48, 100, 118, 130, 148, 168];
    const headers = ["#", "Date", "Description", "Party", "Qty", "Rate", "Amount", "Type"];
    const colW = [10, 23, 52, 18, 12, 18, 20, 15];

    doc.setFillColor(30, 80, 180);
    doc.rect(15, y - 5, pageW - 30, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    headers.forEach((h, i) => doc.text(h, colX[i] + 1, y));
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    transactions.forEach((t, idx) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      const bg = idx % 2 === 0 ? [248, 250, 255] : [255, 255, 255];
      doc.setFillColor(bg[0], bg[1], bg[2]);
      doc.rect(15, y - 4, pageW - 30, 7, "F");
      doc.setTextColor(30, 30, 30);

      const cells = [
        String(idx + 1),
        t.date,
        t.description.slice(0, 28),
        (t.partyName ?? "").slice(0, 14),
        t.quantity ?? "",
        t.rate ? `${Number(t.rate).toFixed(2)}` : "",
        `${Number(t.amount).toFixed(2)}`,
        t.transactionType ?? "",
      ];
      cells.forEach((c, i) => doc.text(c, colX[i] + 1, y));
      y += 7;
    });

    y += 3;
    doc.setDrawColor(30, 80, 180);
    doc.setLineWidth(0.4);
    doc.line(15, y, pageW - 15, y);
    y += 6;

    doc.setFillColor(30, 80, 180);
    doc.rect(100, y - 5, pageW - 115, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text("GRAND TOTAL:", 102, y);
    doc.text(`Rs. ${grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 148, y);
    y += 12;

    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text("Thank you for your business!", pageW / 2, y, { align: "center" });

    doc.save(`${COMPANY_NAME}_Invoice.pdf`);
  }

  const inputCls = "border border-gray-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-400";

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-700 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-wide">{COMPANY_NAME}</h1>
            <p className="text-blue-200 text-sm mt-0.5">Ledger &amp; Invoice Manager</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={exportExcel}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              <FileSpreadsheet size={16} />
              Export Excel
            </button>
            <button
              onClick={exportInvoicePDF}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              <FileText size={16} />
              Download Invoice PDF
            </button>
            <button
              onClick={() => { setAddOpen(true); setForm(emptyInput()); }}
              className="flex items-center gap-2 bg-white text-blue-700 hover:bg-blue-50 px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              <Plus size={16} />
              Add Entry
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {addOpen && (
          <div className="bg-white border border-blue-200 rounded-xl shadow-md mb-6 p-5">
            <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Plus size={16} className="text-blue-600" /> New Entry
            </h2>
            <form onSubmit={handleAddSubmit} className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Date *</label>
                <input type="date" className={inputCls} value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Description *</label>
                <input type="text" className={inputCls} value={form.description} placeholder="Item or transaction details"
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Type</label>
                <select className={inputCls} value={form.transactionType}
                  onChange={e => setForm(f => ({ ...f, transactionType: e.target.value }))}>
                  <option value="entry">Entry</option>
                  <option value="sale">Sale</option>
                  <option value="purchase">Purchase</option>
                  <option value="payment">Payment</option>
                  <option value="receipt">Receipt</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Party Name</label>
                <input type="text" className={inputCls} value={form.partyName} placeholder="Customer/Vendor"
                  onChange={e => setForm(f => ({ ...f, partyName: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Quantity</label>
                <input type="number" className={inputCls} value={form.quantity} placeholder="0"
                  onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Rate (₹)</label>
                <input type="number" className={inputCls} value={form.rate} placeholder="0.00"
                  onChange={e => setForm(f => ({
                    ...f,
                    rate: e.target.value,
                    amount: e.target.value && f.quantity ? String(Number(e.target.value) * Number(f.quantity)) : f.amount
                  }))} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Amount (₹) *</label>
                <input type="number" className={inputCls} value={form.amount} placeholder="0.00"
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
              </div>
              <div className="md:col-span-4">
                <label className="text-xs text-gray-500 mb-1 block">Notes</label>
                <input type="text" className={inputCls} value={form.notes} placeholder="Optional notes"
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="md:col-span-4 flex gap-2 justify-end pt-1">
                <button type="button" onClick={() => setAddOpen(false)}
                  className="flex items-center gap-1 px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-100 transition">
                  <X size={14} /> Cancel
                </button>
                <button type="submit" disabled={createMut.isPending}
                  className="flex items-center gap-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
                  <Save size={14} /> Save Entry
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-700 text-sm">Ledger Entries</h2>
            <span className="text-xs text-gray-400">{transactions.length} records</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blue-50 text-blue-800 text-xs uppercase tracking-wide">
                  <th className="px-4 py-3 text-left font-semibold w-10">#</th>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Description</th>
                  <th className="px-4 py-3 text-left font-semibold">Party</th>
                  <th className="px-4 py-3 text-right font-semibold">Qty</th>
                  <th className="px-4 py-3 text-right font-semibold">Rate</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                  <th className="px-4 py-3 text-left font-semibold">Type</th>
                  <th className="px-4 py-3 text-left font-semibold">Notes</th>
                  <th className="px-4 py-3 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={10} className="text-center py-10 text-gray-400">Loading...</td></tr>
                )}
                {!isLoading && transactions.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center py-16 text-gray-400">
                      <FileSpreadsheet size={40} className="mx-auto mb-2 opacity-30" />
                      <p>No entries yet. Click "Add Entry" to get started.</p>
                    </td>
                  </tr>
                )}
                {transactions.map((t, idx) => (
                  <tr key={t.id} className={`border-t border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"} hover:bg-blue-50/30 transition`}>
                    {editId === t.id ? (
                      <>
                        <td className="px-4 py-2 text-gray-400">{idx + 1}</td>
                        <td className="px-2 py-1"><input type="date" className={inputCls} value={editForm.date}
                          onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} /></td>
                        <td className="px-2 py-1"><input type="text" className={inputCls} value={editForm.description}
                          onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} /></td>
                        <td className="px-2 py-1"><input type="text" className={inputCls} value={editForm.partyName}
                          onChange={e => setEditForm(f => ({ ...f, partyName: e.target.value }))} /></td>
                        <td className="px-2 py-1"><input type="number" className={inputCls} value={editForm.quantity}
                          onChange={e => setEditForm(f => ({ ...f, quantity: e.target.value }))} /></td>
                        <td className="px-2 py-1"><input type="number" className={inputCls} value={editForm.rate}
                          onChange={e => setEditForm(f => ({ ...f, rate: e.target.value }))} /></td>
                        <td className="px-2 py-1"><input type="number" className={inputCls} value={editForm.amount}
                          onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} /></td>
                        <td className="px-2 py-1">
                          <select className={inputCls} value={editForm.transactionType}
                            onChange={e => setEditForm(f => ({ ...f, transactionType: e.target.value }))}>
                            <option value="entry">Entry</option>
                            <option value="sale">Sale</option>
                            <option value="purchase">Purchase</option>
                            <option value="payment">Payment</option>
                            <option value="receipt">Receipt</option>
                          </select>
                        </td>
                        <td className="px-2 py-1"><input type="text" className={inputCls} value={editForm.notes}
                          onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} /></td>
                        <td className="px-2 py-1">
                          <div className="flex gap-1 justify-center">
                            <button onClick={() => handleEditSubmit(t.id)} disabled={updateMut.isPending}
                              className="p-1.5 rounded bg-green-100 text-green-700 hover:bg-green-200 transition"><Save size={14} /></button>
                            <button onClick={() => setEditId(null)}
                              className="p-1.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition"><X size={14} /></button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{t.date}</td>
                        <td className="px-4 py-3 font-medium text-gray-800">{t.description}</td>
                        <td className="px-4 py-3 text-gray-600">{t.partyName || "—"}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{t.quantity || "—"}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{t.rate ? formatCurrency(t.rate) : "—"}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(t.amount)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            t.transactionType === "sale" ? "bg-green-100 text-green-700" :
                            t.transactionType === "purchase" ? "bg-red-100 text-red-700" :
                            t.transactionType === "payment" ? "bg-yellow-100 text-yellow-700" :
                            t.transactionType === "receipt" ? "bg-blue-100 text-blue-700" :
                            "bg-gray-100 text-gray-600"
                          }`}>{t.transactionType || "entry"}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{t.notes || "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 justify-center">
                            <button onClick={() => startEdit(t)}
                              className="p-1.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition"><Pencil size={13} /></button>
                            <button onClick={() => { if (confirm("Delete this entry?")) deleteMut.mutate(t.id); }}
                              className="p-1.5 rounded bg-red-50 text-red-500 hover:bg-red-100 transition"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-blue-200 bg-blue-700">
                  <td colSpan={6} className="px-4 py-4 text-right font-bold text-white text-sm tracking-wide uppercase">
                    Grand Total
                  </td>
                  <td className="px-4 py-4 text-right font-bold text-white text-lg">
                    {formatCurrency(grandTotal)}
                  </td>
                  <td colSpan={3} className="px-4 py-4 text-blue-200 text-xs">
                    {transactions.length} entr{transactions.length === 1 ? "y" : "ies"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </main>

      <footer className="mt-10 py-4 text-center text-xs text-gray-400 border-t border-gray-100">
        {COMPANY_NAME} &mdash; Ledger Management System
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MainApp />
    </QueryClientProvider>
  );
}
