import { LayoutDashboard, Server, Bell, BarChart3, Clock, Settings, Shield, ChevronLeft, ChevronRight } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useSidebarState } from "./SidebarContext";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Devices", url: "/devices", icon: Server },
  { title: "Alerts", url: "/alerts", icon: Bell },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Timeline", url: "/timeline", icon: Clock },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { collapsed, setCollapsed } = useSidebarState();
  const location = useLocation();

  return (
    <aside
      className={`fixed top-0 left-0 h-screen z-40 flex flex-col bg-sidebar transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        collapsed ? "w-[68px]" : "w-[240px]"
      }`}
    >
      {/* Logo */}
      <div className={`flex items-center h-16 border-b border-border/50 ${collapsed ? 'px-4 justify-center' : 'px-5 gap-3'}`}>
        <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
          <Shield className="h-4 w-4 text-primary" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in">
            <span className="text-[13px] font-semibold text-foreground tracking-tight">Machine Guardian</span>
            <span className="block text-[10px] text-muted-foreground font-medium">AI Monitoring</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-3 space-y-0.5">
        {!collapsed && (
          <span className="block text-[10px] font-medium text-muted-foreground/70 uppercase tracking-[0.1em] px-3 mb-2 mt-1">
            Navigation
          </span>
        )}
        {navItems.map((item) => {
          const isActive = item.url === "/" ? location.pathname === "/" : location.pathname.startsWith(item.url);
          return (
            <NavLink
              key={item.url}
              to={item.url}
              end={item.url === "/"}
              className={`flex items-center gap-3 rounded-lg text-[13px] transition-all duration-200 ${
                collapsed ? 'px-0 py-2.5 justify-center' : 'px-3 py-2'
              } ${
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-sidebar-foreground hover:bg-surface-hover hover:text-foreground"
              }`}
              activeClassName=""
            >
              <item.icon className={`shrink-0 ${isActive ? 'text-primary' : ''}`} style={{ width: 18, height: 18 }} />
              {!collapsed && <span className="truncate">{item.title}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="px-3 pb-4">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`flex items-center gap-2 w-full rounded-lg py-2 text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-all duration-200 text-[12px] ${
            collapsed ? 'justify-center px-0' : 'px-3'
          }`}
        >
          {collapsed ? (
            <ChevronRight style={{ width: 16, height: 16 }} />
          ) : (
            <>
              <ChevronLeft style={{ width: 16, height: 16 }} />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
