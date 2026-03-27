import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LayoutDashboard, Settings, Sun, Moon } from "lucide-react";
import type { CalcSettings } from "./types";
import { getSettings } from "./lib/api";
import LedgerDashboard from "./LedgerDashboard";
import CalcSettingsPage from "./CalcSettings";

const queryClient = new QueryClient();

const APP_NAME = "Vizianagram Mangoes";
const APP_SUB = "Accounting Sheet";

function MainApp() {
  const [page, setPage] = useState<"ledger" | "settings">("ledger");
  const [dark, setDark] = useState(true);
  const [settingsOverride, setSettingsOverride] = useState<CalcSettings | null>(null);

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  const activeSettings = settingsOverride ?? settings;

  if (settingsLoading || !activeSettings) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${dark ? "bg-[#0d1117] text-gray-300" : "bg-gray-50 text-gray-700"}`}>
        Loading...
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${dark ? "bg-[#0d1117]" : "bg-[#f6f8fa]"}`}>
      <header className={`border-b ${dark ? "bg-[#0d1117] border-[#30363d]" : "bg-white border-gray-200"} px-5 py-3 flex items-center gap-4 sticky top-0 z-20`}>
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${dark ? "bg-blue-700 text-white" : "bg-blue-600 text-white"}`}>
            GXM
          </div>
          <div>
            <div className={`font-bold text-sm ${dark ? "text-white" : "text-gray-900"}`}>{APP_NAME}</div>
            <div className={`text-[10px] ${dark ? "text-gray-500" : "text-gray-400"}`}>{APP_SUB}</div>
          </div>
        </div>

        <div className={`flex items-center gap-1 rounded-lg p-1 ${dark ? "bg-[#161b22]" : "bg-gray-100"} ml-4`}>
          <button onClick={() => setPage("ledger")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${page==="ledger" ? (dark?"bg-[#0d1117] text-white shadow":"bg-white text-gray-900 shadow") : (dark?"text-gray-400 hover:text-white":"text-gray-500 hover:text-gray-900")}`}>
            <LayoutDashboard size={13} /> Ledger Dashboard
          </button>
          <button onClick={() => setPage("settings")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${page==="settings" ? (dark?"bg-[#0d1117] text-white shadow":"bg-white text-gray-900 shadow") : (dark?"text-gray-400 hover:text-white":"text-gray-500 hover:text-gray-900")}`}>
            <Settings size={13} /> Calculation Settings
          </button>
        </div>

        <div className="flex-1" />
        <button onClick={() => setDark(d => !d)}
          className={`p-2 rounded-lg transition ${dark ? "text-gray-400 hover:text-white hover:bg-[#161b22]" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"}`}>
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </header>

      <div className={`flex-1 flex flex-col overflow-hidden ${dark ? "text-gray-200" : "text-gray-800"}`}>
        {page === "ledger" && <LedgerDashboard settings={activeSettings} />}
        {page === "settings" && (
          <CalcSettingsPage settings={activeSettings} onSaved={s => {
            setSettingsOverride({ ...s, station_rate: Number(s.station_rate), commission_pct: Number(s.commission_pct), truck_fare: Number(s.truck_fare), pt_rate: Number(s.pt_rate), custom_fields: (s as any).custom_fields ?? [] });
            setPage("ledger");
          }} />
        )}
      </div>
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
