import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LayoutDashboard, Settings, Sun, Moon, LogOut } from "lucide-react";
import type { CalcSettings } from "./types";
import { getSettings } from "./lib/api";
import LedgerDashboard from "./LedgerDashboard";
import CalcSettingsPage from "./CalcSettings";
import LoginPage from "./LoginPage";

const queryClient = new QueryClient();

const APP_NAME = "Vizianagram Mangoes";
const APP_SUB = "Accounting Sheet";

function MainApp() {
  const [loggedIn, setLoggedIn] = useState(() => localStorage.getItem("gxm_auth") === "1");
  const [page, setPage] = useState<"ledger" | "settings">("ledger");
  const [dark, setDark] = useState(true);
  const [settingsOverride, setSettingsOverride] = useState<CalcSettings | null>(null);

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [dark]);

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
    enabled: loggedIn,
  });

  const activeSettings = settingsOverride ?? settings;

  if (!loggedIn) {
    return <LoginPage onLogin={() => setLoggedIn(true)} />;
  }

  if (settingsLoading || !activeSettings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0d1117] text-gray-600 dark:text-gray-300">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-[#0d1117]">
      <header className="border-b bg-white dark:bg-[#0d1117] border-gray-200 dark:border-[#30363d] px-5 py-3 flex items-center gap-4 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs bg-blue-600 text-white">
            GXM
          </div>
          <div>
            <div className="font-bold text-sm text-gray-900 dark:text-white">{APP_NAME}</div>
            <div className="text-[10px] text-gray-400 dark:text-gray-500">{APP_SUB}</div>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-lg p-1 bg-gray-100 dark:bg-[#161b22] ml-4">
          <button onClick={() => setPage("ledger")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${page === "ledger" ? "bg-white dark:bg-[#0d1117] text-gray-900 dark:text-white shadow" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"}`}>
            <LayoutDashboard size={13} /> Ledger Dashboard
          </button>
          <button onClick={() => setPage("settings")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${page === "settings" ? "bg-white dark:bg-[#0d1117] text-gray-900 dark:text-white shadow" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"}`}>
            <Settings size={13} /> Calculation Settings
          </button>
        </div>

        <div className="flex-1" />
        <button onClick={() => setDark(d => !d)}
          className="p-2 rounded-lg transition text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#161b22]">
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button onClick={() => { localStorage.removeItem("gxm_auth"); setLoggedIn(false); }}
          className="p-2 rounded-lg transition text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-[#161b22]" title="Logout">
          <LogOut size={16} />
        </button>
      </header>

      <div className="flex-1 flex flex-col overflow-hidden text-gray-800 dark:text-gray-200">
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
