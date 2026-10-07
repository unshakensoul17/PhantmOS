import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import { Search, Sparkles, Building, FileCheck, CheckCircle2, Send, ChevronRight } from "lucide-react";

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
    { name: "Discovery", icon: Search, tasks: stats?.total || 0, status: "active", desc: "Scanning 240+ verified sources" },
    { name: "Match Scoring", icon: Sparkles, tasks: stats?.total || 0, status: "active", desc: "Evaluating fit with your resume" },
    { name: "Company Intel", icon: Building, tasks: (stats?.hot || 0) + (stats?.warm || 0), status: "active", desc: "Researching culture & tech stack" },
    { name: "Resume Tailoring", icon: FileCheck, tasks: stats?.tailored || 0, status: stats?.tailored > 0 ? "active" : "idle", desc: "Customizing bullets & keywords" },
    { name: "ATS Verification", icon: CheckCircle2, tasks: stats?.tailored || 0, status: stats?.tailored > 0 ? "active" : "idle", desc: "Passing automated filters" },
    { name: "Application Queue", icon: Send, tasks: stats?.applied || 0, status: stats?.applied > 0 ? "active" : "idle", desc: "Ready for your review & sending" },
  ];

  const content = (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-zinc-400 mb-0.5">Automated System</div>
          <h3 className="text-sm font-semibold text-white">Multi-Agent Workflow</h3>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-300 bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800">
          <span className="w-1.5 h-1.5 rounded-full bg-white" />
          <span>6 agents active</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {AGENTS.map((a, i) => (
          <div key={a.name} className="relative">
            <AgentNode {...a} index={i} />
            {i < AGENTS.length - 1 && (
              <div className="hidden xl:block absolute top-1/2 -right-2 -translate-y-1/2 z-10 text-zinc-700">
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );

  if (inline) {
    return (
      <div className="mt-6 pt-6 border-t border-zinc-800/80 animate-fade-up">
        {content}
      </div>
    );
  }

  return (
    <section className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-5 mb-6">
      {content}
    </section>
  );
}

function AgentNode({ name, icon: Icon, tasks, desc, index }: any) {
  return (
    <div
      className="bg-black border border-zinc-800/90 hover:border-zinc-700 rounded-xl p-3.5 transition-all"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-700 grid place-items-center text-white">
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-[11px] font-mono text-zinc-500">0{index + 1}</span>
      </div>
      <div className="text-xs font-semibold text-white truncate">{name}</div>
      <div className="text-[11px] text-zinc-400 mt-0.5 leading-tight h-7 overflow-hidden line-clamp-2">{desc}</div>
      <div className="mt-2.5 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs">
        <span className="font-mono font-semibold text-white">{tasks.toLocaleString()}</span>
        <span className="text-[11px] text-zinc-500">items</span>
      </div>
    </div>
  );
}
