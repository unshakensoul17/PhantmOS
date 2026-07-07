import { ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard, Search, Sparkles, FileText, Building2, Send,
  BarChart3, Settings, Ghost, Bell, MessageCircle, Activity,
  ChevronRight, Cpu, Wifi, Command, LogOut, Home,
} from "lucide-react";
import { AuthGuard } from "./AuthGuard";
import { useAuth } from "../hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";

function Sidebar() {
  const location = useLocation();
  const { signOut } = useAuth();
  
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const res = await apiFetch("/api/stats");
      if (!res.ok) return { discovered: 0, applied: 0 };
      return res.json();
    },
    refetchInterval: 15000,
  });

  // Calculate total active applications for the sidebar badge
  const activeApps = (stats?.approved || 0) + (stats?.applied || 0) + (stats?.interviews || 0);

  const NAV = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: FileText, label: "Resume Studio", path: "/resume-studio" },
    { icon: Search, label: "Job Discovery", badge: stats?.discovered?.toString() || "0", path: "/job-discovery" },
    { icon: Building2, label: "Company Research", path: "/company-research" },
    { icon: Send, label: "Applications", badge: activeApps.toString(), path: "/applications" },
    { icon: Settings, label: "Settings", path: "/settings" },
  ];
  
  return (
    <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-64 flex-col glass-strong border-r border-white/8 z-40">
      <Link to="/" className="flex items-center gap-3 px-6 h-20 border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer">
        <div className="relative">
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-black grid place-items-center border border-white/10 glow-blue p-1">
            <img src="/logo.png" alt="PhantmOS Logo" className="w-full h-full object-contain" />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-neon-green ring-2 ring-[#0B1020] animate-pulse-glow" />
        </div>
        <div className="min-w-0">
          <div className="font-bold tracking-tight text-[15px] leading-tight">PhantmOS</div>
          <div className="text-[12px] font-medium text-muted-foreground">Engine v3.2</div>
        </div>
      </Link>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <div className="px-3 pb-2 text-[12px] font-medium text-muted-foreground/60">Command</div>
        {NAV.map((item, i) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.label}
              to={item.path}
              className={`group w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[15px] transition-all relative overflow-hidden ${
                isActive
                  ? "bg-gradient-to-r from-neon-blue/20 via-neon-purple/10 to-transparent text-white border border-neon-blue/30"
                  : "text-muted-foreground hover:text-white hover:bg-white/5"
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r bg-gradient-to-b from-neon-blue to-neon-purple" />
              )}
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-neon-cyan" : ""}`} />
              <span className="flex-1 text-left font-medium">{item.label}</span>
              {item.badge && (
                <span className="text-[12px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-neon-cyan">
                  {item.badge}
                </span>
              )}
              {i === 0 && (
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-white/5">
        <div className="glass rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-neon-green" />
              <span className="text-[12px] font-mono text-muted-foreground">Engine Usage</span>
            </div>
            <span className="text-[10px] font-mono text-neon-cyan">{Math.round(((stats?.credits ?? 0) / (stats?.max_credits ?? 1000)) * 100)}%</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-mono text-muted-foreground">Tokens</span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold font-mono text-glow-cyan text-neon-cyan">{(stats?.credits ?? 0).toLocaleString()}</span>
              <span className="text-xs text-muted-foreground">/ {(stats?.max_credits ?? 1000).toLocaleString()}</span>
            </div>
          </div>
          <div className="mt-2 h-1 rounded-full bg-white/5 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-neon-blue to-neon-cyan transition-all duration-1000" 
              style={{ width: `${Math.round(((stats?.credits ?? 0) / (stats?.max_credits ?? 1000)) * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}

function StatusPill({ icon: Icon, label, value, color, onClick, loading }: { icon: any; label: string; value: string; color: "green" | "cyan" | "amber" | "red"; onClick?: () => void; loading?: boolean }) {
  const dot = color === "green" ? "bg-neon-green" : color === "amber" ? "bg-neon-amber" : color === "red" ? "bg-red-500" : "bg-neon-cyan";
  const Comp = onClick ? "button" : "div";
  return (
    <Comp 
      onClick={onClick}
      disabled={loading}
      className={`hidden md:flex items-center gap-2 h-11 px-3 rounded-xl glass ${onClick ? 'cursor-pointer hover:bg-white/10 transition-colors' : ''} ${loading ? 'opacity-70' : ''}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot} ${!loading ? 'animate-pulse-glow' : ''}`} />
      <Icon className={`w-3.5 h-3.5 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
      <div className="text-[13px] leading-none text-left">
        <div className="text-muted-foreground font-mono text-[13px]">{label}</div>
        <div className="font-semibold mt-0.5">{value}</div>
      </div>
    </Comp>
  );
}

function TopBar() {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await apiFetch("/api/settings");
      if (!res.ok) return {};
      return res.json();
    }
  });

  const { data: health, isFetching: isCheckingHealth } = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      try {
        const res = await apiFetch("/api/health");
        if (!res.ok) return { status: "offline" };
        return res.json();
      } catch (e) {
        return { status: "offline" };
      }
    },
    refetchInterval: 30000,
  });

  return (
    <header className="sticky top-0 z-30 h-20 glass-strong border-b border-white/5 flex items-center gap-4 px-6">
      <div className="flex-1 max-w-xl">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            placeholder="Search jobs, companies, agents…"
            className="w-full h-11 pl-10 pr-20 rounded-xl glass text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all duration-200"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-muted-foreground">
            <span className="text-[11px] font-bold">Ctrl</span>
            <span className="text-[11px] font-bold">K</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <StatusPill 
          icon={Wifi} 
          label="Telegram" 
          value={settings?.telegram_connected ? "Synced" : "Pending"} 
          color={settings?.telegram_connected ? "green" : "amber"} 
        />
        <StatusPill 
          icon={Activity} 
          label="System" 
          value={isCheckingHealth ? "Pinging..." : (health?.status === "ok" ? "Nominal" : "Offline")} 
          color={health?.status === "ok" ? "cyan" : "red"} 
          loading={isCheckingHealth}
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["health"] });
          }}
        />

        <div className="flex items-center gap-3 pl-4 ml-2 border-l border-white/10">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-medium leading-none text-white/90">{user?.email?.split('@')[0] || 'User'}</div>
            <div className="flex items-center justify-end gap-1.5 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse-glow" />
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Online</div>
            </div>
          </div>
          <button 
            onClick={() => signOut()}
            className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-white/20 hover:text-red-400 transition-colors text-muted-foreground ml-1"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <div className="min-h-screen text-foreground">
        <Sidebar />
        <div className="lg:pl-64">
          <TopBar />
          <main className="p-4 md:p-6 xl:p-8 space-y-6 max-w-[1800px] mx-auto">
            {children}
          </main>
        </div>
        
        {/* Ambient orbs */}
        <div className="pointer-events-none fixed -top-40 -left-40 w-96 h-96 rounded-full bg-neon-blue/15 blur-[120px]" />
        <div className="pointer-events-none fixed top-1/3 -right-40 w-96 h-96 rounded-full bg-neon-purple/15 blur-[120px]" />
        <div className="pointer-events-none fixed bottom-0 left-1/3 w-96 h-96 rounded-full bg-neon-cyan/10 blur-[120px]" />
      </div>
    </AuthGuard>
  );
}
