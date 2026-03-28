import { useState } from "react";
import { Activity, Percent, Truck, FileText, Plus, Save, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CalcSettings, CustomField } from "./types";
import { saveSettings } from "./lib/api";

interface Props { settings: CalcSettings; onSaved: (s: CalcSettings) => void; }

export default function CalcSettingsPage({ settings, onSaved }: Props) {
  const [stationRate, setStationRate] = useState(String(settings.station_rate));
  const [commPct, setCommPct] = useState(String(settings.commission_pct));
  const [truckFare, setTruckFare] = useState(String(settings.truck_fare));
  const [ptRate, setPtRate] = useState(String(settings.pt_rate));
  const [customFields, setCustomFields] = useState<CustomField[]>(settings.custom_fields ?? []);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldVal, setNewFieldVal] = useState("0");
  const [newFieldPerUnit, setNewFieldPerUnit] = useState(false);

  const saveMut = useMutation({
    mutationFn: () => saveSettings({
      station_rate: Number(stationRate),
      commission_pct: Number(commPct),
      truck_fare: Number(truckFare),
      pt_rate: Number(ptRate),
      custom_fields: customFields,
    }),
    onSuccess: (data: any) => onSaved(data),
  });

  function addField() {
    if (!newFieldName.trim()) return;
    setCustomFields(prev => [...prev, { name: newFieldName, default_value: Number(newFieldVal), per_unit: newFieldPerUnit }]);
    setNewFieldName(""); setNewFieldVal("0"); setNewFieldPerUnit(false);
  }
  function removeField(i: number) { setCustomFields(prev => prev.filter((_, idx) => idx !== i)); }

  const inputCls = "bg-gray-100 dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-52";

  const fields = [
    { icon: <Activity size={18} className="text-blue-500" />, bg: "bg-blue-100 dark:bg-blue-900/40", label: "Station Rate (per box)", desc: "Fixed cost applied per unit quantity recorded.", prefix: "₹", value: stationRate, set: setStationRate, suffix: undefined },
    { icon: <Percent size={18} className="text-purple-500" />, bg: "bg-purple-100 dark:bg-purple-900/40", label: "Commission Percentage", desc: "Percentage taken from the total amount (Qty × Rate).", prefix: undefined, value: commPct, set: setCommPct, suffix: "%" },
    { icon: <Truck size={18} className="text-orange-500" />, bg: "bg-orange-100 dark:bg-orange-900/40", label: "Truck Fare (per box)", desc: "Transport cost applied per unit quantity recorded.", prefix: "₹", value: truckFare, set: setTruckFare, suffix: undefined },
    { icon: <FileText size={18} className="text-green-500" />, bg: "bg-green-100 dark:bg-green-900/40", label: "P & T", desc: "₹0 flat per row", prefix: "₹", value: ptRate, set: setPtRate, suffix: undefined },
  ];

  return (
    <div className="flex-1 overflow-auto p-8 max-w-3xl mx-auto">
      <h1 className="text-gray-900 dark:text-white text-2xl font-bold mb-1">Calculation Settings</h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">Configure the default rates and percentages used for automated ledger calculations.</p>

      <div className="space-y-4">
        {fields.map(f => (
          <div key={f.label} className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] rounded-xl p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className={`${f.bg} p-2.5 rounded-lg flex-shrink-0`}>{f.icon}</div>
              <div className="flex-1">
                <h3 className="text-gray-900 dark:text-white font-semibold text-sm mb-0.5">{f.label}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-xs mb-3">{f.desc}</p>
                <div className="relative w-52">
                  {f.prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm">{f.prefix}</span>}
                  <input type="number" value={f.value} onChange={e => f.set(e.target.value)}
                    className={`${inputCls} ${f.prefix ? "pl-7" : ""} ${f.suffix ? "pr-8" : ""}`} />
                  {f.suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm">{f.suffix}</span>}
                </div>
              </div>
            </div>
          </div>
        ))}

        {customFields.length > 0 && (
          <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-gray-900 dark:text-white font-semibold text-sm">Custom Fields</h3>
            {customFields.map((cf, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-[#30363d] last:border-0">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  <span className="text-gray-800 dark:text-gray-200 text-sm font-medium">{cf.name}</span>
                  <span className="text-gray-500 dark:text-gray-500 text-xs bg-gray-100 dark:bg-[#1c2333] px-2 py-0.5 rounded">₹{cf.default_value}{cf.per_unit ? " per unit" : " flat"}</span>
                </div>
                <button onClick={() => removeField(i)} className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition p-1"><X size={14} /></button>
              </div>
            ))}
          </div>
        )}

        <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] rounded-xl p-5 shadow-sm">
          <h3 className="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider mb-4">ADD CUSTOM FIELD</h3>
          <div className="grid grid-cols-3 gap-3 items-end">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Field Name</label>
              <input value={newFieldName} onChange={e => setNewFieldName(e.target.value)} placeholder="e.g. Loading, Hamali"
                className="bg-gray-100 dark:bg-[#1c2333] border border-gray-200 dark:border-[#30363d] rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 w-full" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Default Value (₹)</label>
              <input type="number" value={newFieldVal} onChange={e => setNewFieldVal(e.target.value)}
                className="bg-gray-100 dark:bg-[#1c2333] border border-gray-200 dark:border-[#30363d] rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 w-full" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">&nbsp;</label>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="per-unit" checked={newFieldPerUnit} onChange={e => setNewFieldPerUnit(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600" />
                <label htmlFor="per-unit" className="text-gray-500 dark:text-gray-400 text-xs">Per unit (×qty)</label>
                <button onClick={addField}
                  className="ml-2 flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition">
                  <Plus size={13} /> Add
                </button>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">Custom fields will appear as columns in the ledger dashboard and be included in expense totals.</p>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs">
          <span>⚙</span> Auto-calculated fields will reflect these changes for new edits.
        </div>
        <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50">
          <Save size={15} /> Save Configuration
        </button>
      </div>
    </div>
  );
}
