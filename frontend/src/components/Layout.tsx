import { ReactNode, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard, Search, FileText, Building2, Send,
  Settings, Cpu, Wifi, LogOut, RefreshCw, Users,
} from "lucide-react";
import { AuthGuard } from "./AuthGuard";
import { useAuth } from "../hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";

function Sidebar({ mobileOpen, setMobileOpen }: { mobileOpen?: boolean; setMobileOpen?: (v: boolean) => void }) {
  const location = useLocation();
  const { signOut } = useAuth();
  
  const queryClient = useQueryClient();

  const { data: credits, isFetching: creditsFetching } = useQuery({
    queryKey: ["sidebar-credits"],
    queryFn: async () => {
      const res = await apiFetch("/api/stats");
      if (!res.ok) return { credits: 0, max_credits: 1000 };
      const d = await res.json();
      return { credits: d.credits ?? 0, max_credits: d.max_credits ?? 1000 };
    },
    refetchInterval: 5000,
    staleTime: 0,
  });

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const res = await apiFetch("/api/stats");
      if (!res.ok) return { discovered: 0, applied: 0 };
      return res.json();
    },
    refetchInterval: 15000,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const res = await apiFetch("/api/leads?limit=200");
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 15000,
  });

  const appsCount = leads.length > 0
    ? leads.filter((l: any) => ["Approved", "Applied", "Interviewing", "Offer"].includes(l.status)).length
    : ((stats?.applied || 0) + (stats?.approved || 0) + (stats?.interviews || 0));

  const foundCount = leads.length > 0
    ? leads.filter((l: any) => !l.status || l.status === "Found").length
    : (stats?.discovered || stats?.total || 0);

  const current = credits?.credits ?? 1000;
  const maxC = credits?.max_credits ?? 1000;
  const pct = Math.round((current / maxC) * 100);

  const NAV = [
    { icon: LayoutDashboard, label: "Home", path: "/dashboard" },
    { icon: Search, label: "Find Jobs", badge: foundCount > 0 ? foundCount.toString() : null, path: "/job-discovery" },
    { icon: FileText, label: "Resume", path: "/resume-studio" },
    { icon: Send, label: "Applications", badge: appsCount > 0 ? appsCount.toString() : null, path: "/applications" },
    { icon: Building2, label: "Companies", path: "/company-research" },
    { icon: Settings, label: "Settings", path: "/settings" },
    { icon: Users, label: "Contact Us", path: "/contact" },
  ];

  return (
    <>
      {mobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden" 
          onClick={() => setMobileOpen?.(false)}
        />
      )}
      <aside className={`fixed left-0 top-0 h-screen w-64 flex-col bg-black z-50 transition-transform duration-300 ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} flex`}>
        <Link to="/" className="flex items-center gap-3 px-5 h-20 hover:bg-zinc-900/50 transition-colors cursor-pointer">
          <div className="w-12 h-12 flex items-center justify-center shrink-0">
            <img 
              src="/logo.png" 
              alt="PhantmOS Logo" 
              className="w-11 h-11 object-contain brightness-150 contrast-125 drop-shadow-[0_0_1px_rgba(255,255,255,0.8)]" 
            />
          </div>
          <div className="min-w-0">
            <div className="font-bold tracking-tight text-[16px] leading-tight text-white">PhantmOS</div>
            <div className="text-[12px] font-normal text-zinc-400">Career Assistant</div>
          </div>
        </Link>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[11px] font-medium tracking-wider uppercase text-zinc-500">Navigation</div>
          {NAV.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.label}
                to={item.path}
                className={`group w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all ${
                  isActive
                    ? "bg-white text-black font-semibold shadow-sm"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900/80"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-black" : "text-zinc-400 group-hover:text-white"}`} />
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && (
                  <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${
                    isActive ? "bg-black/15 text-black font-bold" : "bg-zinc-900 text-zinc-300"
                  }`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Engine Credits Card */}
        <div className="p-3">
          <div className="bg-zinc-950 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-zinc-300" />
                <span className="text-[11px] font-mono text-zinc-400">Engine Credits</span>
              </div>
              <button
                title="Refresh credits"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["sidebar-credits"] })}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${creditsFetching ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold font-mono text-white">
                {current.toLocaleString()}
              </span>
              <span className="text-xs text-zinc-500 font-mono">/ {maxC.toLocaleString()}</span>
            </div>

            <div className="h-1.5 rounded-full bg-zinc-900 overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-700 ease-in-out"
                style={{ width: `${pct}%` }}
              />
            </div>

            <div className="text-[10px] font-mono text-zinc-500 text-right">
              {pct}% remaining
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function StatusPill({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="hidden md:flex items-center gap-2 h-10 px-3.5 rounded-xl bg-zinc-950 text-white text-xs">
      <span className="w-1.5 h-1.5 rounded-full bg-white" />
      <Icon className="w-3.5 h-3.5 text-zinc-400" />
      <div className="text-[12px] leading-none text-left">
        <span className="text-zinc-400 font-mono text-[11px] mr-1.5">{label}:</span>
        <span className="font-semibold text-white">{value}</span>
      </div>
    </div>
  );
}

function TopBar({ setMobileOpen }: { setMobileOpen?: (v: boolean) => void }) {
  const { user, signOut } = useAuth();
  
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await apiFetch("/api/settings");
      if (!res.ok) return {};
      return res.json();
    }
  });

  return (
    <header className="sticky top-0 z-30 h-20 bg-black/90 backdrop-blur-md flex items-center gap-4 px-6">
      <button 
        className="lg:hidden text-zinc-400 hover:text-white p-2 -ml-2" 
        onClick={() => setMobileOpen?.(true)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" x2="21" y1="6" y2="6"/><line x1="3" x2="21" y1="12" y2="12"/><line x1="3" x2="21" y1="18" y2="18"/></svg>
      </button>
      <div className="flex-1"></div>

      <div className="flex items-center gap-2.5">
        <StatusPill 
          icon={Wifi} 
          label="Telegram" 
          value={settings?.telegram_connected ? "Synced" : "Ready"} 
        />

        <div className="flex items-center gap-3 pl-3 ml-2">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-white leading-none">{user?.email?.split('@')[0] || 'User'}</div>
            <div className="flex items-center justify-end gap-1.5 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              <div className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">Online</div>
            </div>
          </div>
          <button 
            onClick={() => signOut()}
            className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center hover:bg-zinc-800 hover:text-white transition-colors text-zinc-400"
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
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <AuthGuard>
      <div className="min-h-screen bg-black text-white">
        <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
        <div className="lg:pl-64 flex flex-col min-h-screen bg-black">
          <TopBar setMobileOpen={setMobileOpen} />
          <main className="flex-1 p-4 md:p-6 xl:p-8 space-y-6 max-w-[1700px] w-full mx-auto relative z-10">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
