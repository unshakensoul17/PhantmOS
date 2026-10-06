import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import { Radar, Brain, Microscope, FileEdit, ShieldCheck, Rocket, ChevronRight } from "lucide-react";

const COLOR_MAP: Record<string, { text: string; glow: string; ring: string; stroke: string }> = {
  blue:   { text: "text-neon-blue",   glow: "glow-blue",   ring: "from-neon-blue/40",   stroke: "stroke-neon-blue" },
  cyan:   { text: "text-neon-cyan",   glow: "glow-cyan",   ring: "from-neon-cyan/40",   stroke: "stroke-neon-cyan" },
  purple: { text: "text-neon-purple", glow: "glow-purple", ring: "from-neon-purple/40", stroke: "stroke-neon-purple" },
  pink:   { text: "text-neon-pink",   glow: "glow-purple", ring: "from-neon-pink/40",   stroke: "stroke-neon-pink" },
  green:  { text: "text-neon-green",  glow: "glow-green",  ring: "from-neon-green/40",  stroke: "stroke-neon-green" },
};

export function AgentPipeline({ inline = false }: { inline?: boolean }) {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const res = await apiFetch("/api/stats");
      if (!res.ok) return { total: 0, hot: 0, warm: 0, applied: 0, tailored: 0 };
      return res.json();
    }
  });

  const AGENTS = [
    { name: "Discovery", icon: Radar, tasks: stats?.total || 0, status: "active", desc: "Scanning 240 sources", color: "cyan" },
    { name: "Ranking",   icon: Brain, tasks: stats?.total || 0,  status: "active", desc: "Neural match scoring", color: "blue" },
    { name: "Research",  icon: Microscope, tasks: (stats?.hot || 0) + (stats?.warm || 0), status: "active", desc: "Deep company intel", color: "purple" },
    { name: "Resume",    icon: FileEdit, tasks: stats?.tailored || 0, status: stats?.tailored > 0 ? "active" : "idle", desc: "Tailoring & ATS pass", color: "pink" },
    { name: "ATS",       icon: ShieldCheck, tasks: stats?.tailored || 0, status: stats?.tailored > 0 ? "active" : "idle", desc: "Keyword optimization", color: "cyan" },
    { name: "Application", icon: Rocket, tasks: stats?.applied || 0, status: stats?.applied > 0 ? "active" : "idle", desc: "Auto-submission queue", color: "green" },
  ];

  const content = (
    <>
      <div className="relative flex items-center justify-between mb-6">
        <div>
          <div className="text-[13px] font-mono text-neon-purple mb-1">Multi-Agent Runtime</div>
          <h2 className="text-xl font-bold">Autonomous Workflow</h2>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse-glow" />
          <span className="font-mono text-muted-foreground">6 agents online</span>
        </div>
      </div>

      <div className="relative grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 xl:gap-2">
        {AGENTS.map((a, i) => (
          <div key={a.name} className="relative">
            <AgentNode {...a} index={i} />
            {i < AGENTS.length - 1 && (
              <div className="hidden xl:block absolute top-1/2 -right-1 -translate-y-1/2 z-10">
                <div className="relative w-4 h-6 overflow-hidden">
                  <ChevronRight className="w-4 h-4 text-neon-cyan/40" />
                  <div className="absolute inset-0 animate-scan-x">
                    <ChevronRight className="w-4 h-4 text-neon-cyan text-glow-cyan" />
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );

  if (inline) {
    return (
      <div className="relative mt-6 pt-6 border-t border-white/5 animate-fade-up">
        {content}
      </div>
    );
  }

  return (
    <section className="glass-strong rounded-2xl p-6 relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />
      {content}
    </section>
  );
}

function AgentNode({ name, icon: Icon, tasks, status, desc, color, index }: any) {
  const c = COLOR_MAP[color];
  const statusColor =
    status === "active" ? "bg-neon-green text-neon-green" :
    status === "processing" ? "bg-neon-amber text-neon-amber" :
    "bg-muted-foreground text-muted-foreground";
  return (
    <div
      className="group relative glass rounded-xl p-4 hover:bg-white/[0.07] transition-all animate-fade-up"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`relative w-10 h-10 rounded-lg glass grid place-items-center ${c.text}`}>
          <Icon className="w-4.5 h-4.5" />
          {status !== "idle" && (
            <span className="absolute -top-0.5 -right-0.5">
              <span className={`absolute inset-0 rounded-full ${statusColor.split(" ")[0]} animate-ping-soft`} />
              <span className={`relative block w-2 h-2 rounded-full ${statusColor.split(" ")[0]}`} />
            </span>
          )}
        </div>
        <div className="text-[13px] font-mono text-muted-foreground">
          A0{index + 1}
        </div>
      </div>
      <div className="text-sm font-bold">{name} Agent</div>
      <div className="text-[12px] text-muted-foreground mt-0.5 leading-tight">{desc}</div>
      <div className="mt-3 pt-3 border-t border-white/5 flex items-baseline justify-between">
        <span className={`font-mono font-bold ${c.text}`}>{tasks.toLocaleString()}</span>
        <span className="text-[13px] font-mono text-muted-foreground">tasks</span>
      </div>
      {status === "processing" && (
        <div className="mt-2 h-0.5 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full w-1/2 bg-gradient-to-r from-transparent via-neon-amber to-transparent animate-scan-x" />
        </div>
      )}
    </div>
  );
}
