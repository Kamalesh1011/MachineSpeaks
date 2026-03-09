import { useEffect, useState } from "react";
import { SidebarContext } from "./SidebarContext";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { startBrowserTelemetryHeartbeat, stopBrowserTelemetryHeartbeat } from "@/lib/browserTelemetry";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    startBrowserTelemetryHeartbeat();
    return () => {
      stopBrowserTelemetryHeartbeat();
    };
  }, []);

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      <div className="min-h-screen flex bg-background">
        <AppSidebar />
        <div className={`flex-1 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          collapsed ? 'ml-[68px]' : 'ml-[240px]'
        }`}>
          <AppHeader />
          <main className="flex-1 p-8 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarContext.Provider>
  );
}
