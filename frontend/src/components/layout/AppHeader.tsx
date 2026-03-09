import { useEffect, useState } from "react";
import { Bell, LogOut, Search, Sparkles } from "lucide-react";
import { clearAuthToken, fetchAlerts } from "@/lib/backend";
import { useNavigate } from "react-router-dom";

export function AppHeader() {
  const [activeAlertCount, setActiveAlertCount] = useState(0);
  const [criticalCount, setCriticalCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const alerts = await fetchAlerts("active");
        if (!mounted) return;
        setActiveAlertCount(alerts.length);
        setCriticalCount(alerts.filter((a) => a.severity === "critical").length);
      } catch {
        if (!mounted) return;
        setActiveAlertCount(0);
        setCriticalCount(0);
      }
    };

    load();
    const iv = setInterval(load, 10000);
    return () => {
      mounted = false;
      clearInterval(iv);
    };
  }, []);

  const onLogout = () => {
    clearAuthToken();
    navigate("/login");
  };

  return (
    <header className="h-16 border-b border-border/50 flex items-center justify-between px-8">
      <div className="flex items-center gap-5">
        {criticalCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-destructive/8 border border-destructive/15">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive pulse-dot" />
            <span className="text-[11px] font-medium text-destructive">
              {criticalCount} Critical Alert{criticalCount > 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-all duration-200">
          <Search style={{ width: 16, height: 16 }} />
        </button>
        <button className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-all duration-200 relative">
          <Bell style={{ width: 16, height: 16 }} />
          {activeAlertCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-destructive" />}
        </button>
        <button className="h-9 px-3 rounded-lg flex items-center gap-2 text-primary bg-primary/8 border border-primary/15 hover:bg-primary/12 transition-all duration-200">
          <Sparkles style={{ width: 14, height: 14 }} />
          <span className="text-[12px] font-medium">AI</span>
        </button>
        <button
          onClick={onLogout}
          className="h-9 px-3 rounded-lg flex items-center gap-2 text-muted-foreground border border-border hover:text-foreground hover:bg-surface-hover transition-all duration-200"
        >
          <LogOut style={{ width: 14, height: 14 }} />
          <span className="text-[12px] font-medium">Logout</span>
        </button>
      </div>
    </header>
  );
}
