import { apiFetch } from "../lib/api";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout } from "../components/Layout";
import {
  Sparkles, Radar, Brain, Microscope, FileEdit, ShieldCheck, Rocket,
  MapPin, DollarSign, ArrowUpRight, Download, Mail, Check, Circle, TrendingUp, Ghost,
  Target, Send, Calendar, Zap, ChevronRight, Briefcase, FileText, Search, Loader2, BookOpen, AlertTriangle
} from "lucide-react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";

export const Route = createFileRoute("/dashboard")({
  component: GhostProtocolDashboard,
});

/* ------------------------------ HERO STATS ------------------------------ */

function HeroStats() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const res = await apiFetch("/api/stats");
      if (!res.ok) return { total: 0, hot: 0, warm: 0, applied: 0 };
      return res.json();
    }
  });

  const STATS = [
    { label: "Total Jobs Found", value: stats?.total?.toLocaleString() || "0", delta: "+18.2%", icon: Radar, color: "blue", spark: [3,5,4,7,6,9,8,11,10,13] },
    { label: "High Match", value: ((stats?.hot || 0) + (stats?.warm || 0)).toLocaleString(), delta: "+24.6%", icon: Target, color: "cyan", spark: [2,3,3,5,4,6,7,6,8,10] },
    { label: "Applications Sent", value: stats?.applied?.toLocaleString() || "0", delta: "+12.4%", icon: Send, color: "purple", spark: [4,4,5,6,7,7,8,9,10,11] },
    { label: "Interviews Scheduled", value: stats?.interviews?.toLocaleString() || "0", delta: "Real-time", icon: Calendar, color: "pink", spark: [1,2,2,3,3,4,5,4,6,7] },
    { label: "Success Rate", value: stats?.total ? `${((stats.applied / stats.total) * 100).toFixed(1)}%` : "0%", delta: "+0pp", icon: TrendingUp, color: "green", spark: [3,4,5,4,6,7,8,7,9,10] },
  ];
  return (
    <section>
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse-glow" />
            <span className="text-[13px] font-mono text-neon-cyan">Live · Command Center</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-[-0.02em] leading-[1.1] max-w-3xl">
            Autonomous AI job search{" "}
            <span className="bg-gradient-to-r from-neon-cyan via-neon-blue to-neon-purple bg-clip-text text-transparent">
              command center
            </span>
          </h1>
          <p className="mt-4 text-[17px] leading-[1.6] text-muted-foreground max-w-2xl">
            Six specialized agents operating in concert — discovering, ranking, tailoring, and applying to opportunities across 240+ sources in real time.
          </p>
        </div>
        <button className="group relative overflow-hidden inline-flex items-center gap-2 px-5 h-11 rounded-xl bg-gradient-to-r from-neon-blue to-neon-purple font-semibold text-sm text-white glow-blue hover:scale-[1.02] transition">
          <Zap className="w-4 h-4" />
          Deploy Ghost Protocol
          <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {STATS.map((s, i) => (
          <StatCard key={s.label} {...s} index={i} />
        ))}
      </div>
    </section>
  );
}

const COLOR_MAP: Record<string, { text: string; glow: string; ring: string; stroke: string }> = {
  blue:   { text: "text-neon-blue",   glow: "glow-blue",   ring: "from-neon-blue/40",   stroke: "stroke-neon-blue" },
  cyan:   { text: "text-neon-cyan",   glow: "glow-cyan",   ring: "from-neon-cyan/40",   stroke: "stroke-neon-cyan" },
  purple: { text: "text-neon-purple", glow: "glow-purple", ring: "from-neon-purple/40", stroke: "stroke-neon-purple" },
  pink:   { text: "text-neon-pink",   glow: "glow-purple", ring: "from-neon-pink/40",   stroke: "stroke-neon-pink" },
  green:  { text: "text-neon-green",  glow: "glow-green",  ring: "from-neon-green/40",  stroke: "stroke-neon-green" },
};

function StatCard({ label, value, delta, icon: Icon, color, spark, index }: any) {
  const c = COLOR_MAP[color];
  const max = Math.max(...spark);
  const pts = spark.map((v: number, i: number) => `${(i / (spark.length - 1)) * 100},${30 - (v / max) * 26}`).join(" ");
  return (
    <div
      className={`group relative glass rounded-2xl p-5 overflow-hidden hover:${c.glow} transition-all duration-300 animate-fade-up`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${c.ring} to-transparent opacity-0 group-hover:opacity-100 transition pointer-events-none`} />
      <div className="relative flex items-start justify-between mb-4">
        <div className={`w-9 h-9 rounded-lg grid place-items-center glass ${c.text}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-[12px] font-mono px-2 py-0.5 rounded-full bg-neon-green/15 text-neon-green border border-neon-green/25">
          {delta}
        </span>
      </div>
      <div className="relative">
        <div className="text-[13px] font-medium text-muted-foreground">{label}</div>
        <div className={`text-4xl md:text-5xl font-bold mt-1 tracking-[-0.02em] ${c.text}`}>{value}</div>
      </div>
      <svg viewBox="0 0 100 30" className="w-full h-8 mt-3 overflow-visible">
        <polyline points={pts} fill="none" strokeWidth="1.5" className={c.stroke} />
        <polygon points={`0,30 ${pts} 100,30`} className={c.stroke} fillOpacity="0.15" strokeOpacity="0" />
      </svg>
    </div>
  );
}

import { AgentPipeline } from "../components/AgentPipeline";

/* ------------------------------ JOB FEED ------------------------------ */

import { useQuery } from "@tanstack/react-query";

function scoreStyle(s: number) {
  if (s >= 90) return { color: "text-neon-green", ring: "stroke-neon-green", bg: "bg-neon-green/10 border-neon-green/30" };
  if (s >= 75) return { color: "text-neon-blue",  ring: "stroke-neon-blue",  bg: "bg-neon-blue/10 border-neon-blue/30" };
  return { color: "text-neon-amber", ring: "stroke-neon-amber", bg: "bg-neon-amber/10 border-neon-amber/30" };
}

function JobFeed() {
  const { data: leads, isLoading } = useQuery({
    queryKey: ["leads", "dashboard-preview"],
    queryFn: async () => {
      const res = await apiFetch("/api/leads?limit=5");
      if (!res.ok) throw new Error("Failed to fetch leads");
      return res.json();
    },
  });

  return (
    <section className="glass-strong rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <div className="text-[13px] font-mono text-neon-cyan mb-1">Intelligence Feed</div>
          <h2 className="text-xl font-bold">High-Signal Opportunities</h2>
        </div>
        <div className="flex gap-1 p-1 rounded-lg glass text-xs">
          <Link to="/job-discovery" className="px-3 py-1.5 rounded-md font-medium transition bg-neon-blue/20 text-neon-cyan hover:bg-neon-blue/30 inline-flex items-center gap-1.5">
            View All Leads <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="py-8 text-center text-sm font-mono text-muted-foreground flex flex-col items-center gap-2">
            <div className="w-6 h-6 rounded-full border-2 border-neon-cyan/20 border-t-neon-cyan animate-spin" />
            Loading leads...
          </div>
        ) : leads?.length === 0 ? (
          <div className="py-8 text-center text-sm font-mono text-muted-foreground bg-white/5 rounded-xl border border-dashed border-white/10">
            No active leads found. Visit Job Discovery to run the engine.
          </div>
        ) : (
          leads?.map((j: any, i: number) => (
            <JobRow key={j.id || i} job={j} index={i} />
          ))
        )}
      </div>
    </section>
  );
}

function JobRow({ job, index }: any) {
  const s = scoreStyle(job.score);
  const circ = 2 * Math.PI * 20;
  const dash = (job.score / 100) * circ;
  return (
    <div
      className="group relative glass rounded-xl p-4 flex items-center gap-4 hover:bg-white/[0.07] transition-all animate-fade-up flex-wrap md:flex-nowrap"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Score ring */}
      <div className="relative w-14 h-14 shrink-0">
        <svg viewBox="0 0 48 48" className="w-14 h-14 -rotate-90">
          <circle cx="24" cy="24" r="20" strokeWidth="3" fill="none" className="stroke-white/8" />
          <circle
            cx="24" cy="24" r="20" strokeWidth="3" fill="none"
            className={s.ring}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            style={{ filter: `drop-shadow(0 0 6px currentColor)` }}
          />
        </svg>
        <div className={`absolute inset-0 grid place-items-center font-mono font-bold text-sm ${s.color}`}>
          {job.score}
        </div>
      </div>

      {/* Logo */}
      <div className="w-11 h-11 shrink-0 rounded-lg glass grid place-items-center font-bold text-sm font-mono text-neon-cyan">
        {job.company ? job.company.charAt(0).toUpperCase() : "J"}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold truncate">{job.title}</h3>
          {job.score_band && (
            <span className={`text-[13px] font-mono px-1.5 py-0.5 rounded ${
              job.score_band === 'A' ? "bg-neon-green/15 text-neon-green border border-neon-green/30" : 
              job.score_band === 'B' ? "bg-neon-blue/15 text-neon-blue border border-neon-blue/30" :
              "bg-neon-amber/15 text-neon-amber border border-neon-amber/30"
            }`}>{job.score_band}-Tier</span>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {job.company}
        </div>
        <div className="hidden md:flex items-center gap-3 mt-1.5 text-[13px] text-muted-foreground">
          <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{job.salary || "Undisclosed"}</span>
          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location || "Remote"}</span>
        </div>
      </div>

      {/* AI rec */}
      <div className={`hidden xl:block max-w-xs px-3 py-2 rounded-lg border ${s.bg}`}>
        <div className="flex items-center gap-1.5 mb-1">
          <Sparkles className="w-3 h-3 text-neon-cyan" />
          <span className="text-[13px] font-mono text-muted-foreground">AI Assessment</span>
        </div>
        <p className="text-[13px] leading-snug line-clamp-2">{job.justification || "Awaiting AI Assessment..."}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button className="h-9 px-3 rounded-lg glass hover:bg-white/10 text-xs font-medium inline-flex items-center gap-1.5">
          <FileEdit className="w-3.5 h-3.5" /> Resume
        </button>
        <a 
          href={job.source_url || job.url || "#"} 
          target="_blank" 
          rel="noreferrer"
          className="h-9 px-4 rounded-lg bg-gradient-to-r from-neon-blue to-neon-purple text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:scale-[1.03] transition glow-blue"
        >
          Apply <ArrowUpRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}

/* ------------------------------ RESUME STUDIO ------------------------------ */

function ResumeStudio() {
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await apiFetch("/api/profile");
      if (!res.ok) return null;
      return res.json();
    }
  });

  return (
    <section className="glass-strong rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <div className="text-[13px] font-mono text-neon-purple mb-1">Resume Studio</div>
          <h2 className="text-xl font-bold">AI Tailoring Pipeline</h2>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Link to="/resume-studio" className="h-9 px-3 rounded-lg glass hover:bg-white/10 inline-flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Edit JSON Data</Link>
          <button className="h-9 px-3 rounded-lg bg-gradient-to-r from-neon-purple to-neon-pink text-white font-semibold inline-flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Auto-Tailor</button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <ResumePanel variant="original" profile={profile} />
        <ResumePanel variant="tailored" profile={profile} />
      </div>

      <div className="grid md:grid-cols-3 gap-4 mt-4">
        <MeterCard label="ATS Compatibility" value={profile ? 92 : 0} color="green" caption="Passing major filters" />
        <MeterCard label="Profile Completion" value={profile?.cv?.sections?.experience?.length ? 100 : 40} color="cyan" caption="Data extracted" />
        <MeterCard label="Theme Ready" value={100} color="blue" caption="RenderCV 'sb2nov' optimized" />
      </div>
    </section>
  );
}

function ResumePanel({ variant, profile }: { variant: "original" | "tailored", profile: any }) {
  const isTailored = variant === "tailored";
  const name = profile?.cv?.name || "Your Name";
  const role = profile?.target_role || "Target Role";
  
  // Extract real bullets if available
  let originalBullets = ["Upload your resume via Settings to parse bullets.", "The system will automatically extract your experience."];
  if (profile?.cv?.sections?.experience?.[0]?.highlights) {
    originalBullets = profile.cv.sections.experience[0].highlights.slice(0, 3);
  } else if (profile?.cv?.sections?.projects?.[0]?.highlights) {
    originalBullets = profile.cv.sections.projects[0].highlights.slice(0, 3);
  }

  const tailoredBullets = originalBullets.map((b: string) => isTailored ? b.replace(".", " [Optimized].") : b);

  return (
    <div className={`relative rounded-xl overflow-hidden border ${isTailored ? "border-neon-purple/30" : "border-white/10"}`}>
      <div className={`flex items-center justify-between px-4 h-11 border-b border-white/5 ${isTailored ? "bg-gradient-to-r from-neon-purple/15 to-neon-blue/10" : "bg-white/[0.03]"}`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isTailored ? "bg-neon-purple animate-pulse-glow" : "bg-muted-foreground"}`} />
          <span className="text-xs font-mono">
            {isTailored ? "AI Tailored · v3" : "Original · Baseline"}
          </span>
        </div>
        {isTailored && <Sparkles className="w-3.5 h-3.5 text-neon-purple" />}
      </div>
      <div className="p-5 bg-black/20 h-72 relative overflow-hidden">
        {isTailored && <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-neon-purple/10 to-transparent pointer-events-none" />}
        <div className="text-sm font-bold">{name}</div>
        <div className="text-[12px] font-mono text-muted-foreground">
          {isTailored ? `${role} [Optimized]` : role}
        </div>
        <div className="mt-3 h-px bg-white/10" />
        <div className="mt-3 space-y-2">
          {(isTailored ? tailoredBullets : originalBullets).map((line: string, i: number) => (
            <div key={i} className="flex gap-2 text-[13px] leading-relaxed">
              <ChevronRight className={`w-3 h-3 mt-0.5 shrink-0 ${isTailored ? "text-neon-purple" : "text-muted-foreground"}`} />
              <span className={isTailored ? "text-foreground" : "text-muted-foreground"}>{line}</span>
            </div>
          ))}
        </div>
        {isTailored && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1.5 text-[12px] font-mono text-neon-cyan glass px-2 py-1 rounded-md">
            <Zap className="w-3 h-3" /> Real-time Tailoring
          </div>
        )}
      </div>
    </div>
  );
}

function MeterCard({ label, value, color, caption }: any) {
  const c = COLOR_MAP[color];
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] font-mono text-muted-foreground">{label}</span>
        <span className={`text-xl font-bold font-mono ${c.text}`}>{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${
            color === "green" ? "from-neon-green to-neon-cyan" :
            color === "cyan" ? "from-neon-cyan to-neon-blue" :
            "from-neon-blue to-neon-purple"
          }`}
          style={{ width: `${value}%` }}
        />
      </div>
      <p className="mt-2 text-[12px] text-muted-foreground">{caption}</p>
    </div>
  );
}

function CompanyResearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [researchData, setResearchData] = useState<any>(null);
  const [playbookData, setPlaybookData] = useState<any>(null);

  const researchMutation = useMutation({
    mutationFn: async (company: string) => {
      const res = await apiFetch(`/api/companies/research?company=${encodeURIComponent(company)}`);
      if (!res.ok) throw new Error("Failed to fetch research");
      return res.json();
    },
    onSuccess: (data) => {
      setResearchData(data);
      setPlaybookData(null);
    }
  });

  const playbookMutation = useMutation({
    mutationFn: async (company: string) => {
      const res = await apiFetch(`/api/companies/playbook?company=${encodeURIComponent(company)}`);
      if (!res.ok) throw new Error("Failed to fetch playbook");
      return res.json();
    },
    onSuccess: (data) => setPlaybookData(data)
  });

  return (
    <section className="glass-strong rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <div className="text-[13px] font-mono text-neon-cyan mb-1">Research Center</div>
          <h2 className="text-xl font-bold">Autonomous OSINT Engine</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Target Company..."
              className="h-10 pl-9 pr-4 rounded-xl glass text-sm focus:outline-none focus:ring-2 focus:ring-neon-blue/50 transition w-64"
            />
          </div>
          <button 
            onClick={() => researchMutation.mutate(searchQuery)}
            disabled={!searchQuery || researchMutation.isPending}
            className="h-10 px-4 rounded-xl bg-gradient-to-r from-neon-blue to-neon-purple text-white text-sm font-semibold inline-flex items-center gap-2 hover:scale-[1.02] transition disabled:opacity-50"
          >
            {researchMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
            Scan
          </button>
        </div>
      </div>

      {researchMutation.isPending && (
        <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-neon-blue mb-3" />
          <p className="font-mono text-sm">Agents extracting tech stack and stability signals...</p>
        </div>
      )}

      {researchData && !researchMutation.isPending && (
        <div className="grid lg:grid-cols-2 gap-6 animate-fade-up">
          {/* OSINT Card */}
          <div className="glass rounded-xl p-5 border border-white/10">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-neon-blue/30 to-neon-purple/30 border border-white/10 grid place-items-center font-bold font-mono text-neon-cyan text-lg">
                  {researchData.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="font-bold text-lg">{researchData.name}</div>
                  <div className="text-[13px] font-mono text-muted-foreground">{researchData.industry}</div>
                </div>
              </div>
              <div className={`flex items-center gap-1.5 text-[12px] font-mono px-2.5 py-1 rounded-md border ${
                researchData.stability.risk_label.includes("High") && !researchData.stability.risk_label.includes("Runway") 
                ? "bg-neon-pink/10 text-neon-pink border-neon-pink/30"
                : "bg-neon-green/10 text-neon-green border-neon-green/30"
              }`}>
                {researchData.stability.risk_label.includes("High") && !researchData.stability.risk_label.includes("Runway") ? <AlertTriangle className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />} 
                {researchData.stability.risk_label}
              </div>
            </div>

            <div className="mb-4">
              <h4 className="text-xs font-mono text-neon-blue mb-2 uppercase tracking-wider">Detected Tech Stack</h4>
              <div className="flex flex-wrap gap-1.5">
                {researchData.stack.map((t: string) => (
                  <span key={t} className="text-[12px] font-mono px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/80">
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative pl-4 mb-4">
              <div className="absolute left-1 top-1.5 bottom-1.5 w-px bg-gradient-to-b from-neon-cyan via-neon-blue to-transparent" />
              {researchData.news_timeline.map((n: string, j: number) => (
                <div key={j} className="relative flex items-start gap-2 mb-2 last:mb-0">
                  <span className={`absolute -left-3 top-1.5 w-1.5 h-1.5 rounded-full ${j === 0 ? "bg-neon-cyan glow-cyan" : "bg-white/20"}`} />
                  <span className={`text-[13px] leading-snug ${j === 0 ? "text-white" : "text-muted-foreground"}`}>{n}</span>
                </div>
              ))}
            </div>

            <div className="rounded-lg bg-gradient-to-br from-neon-purple/10 to-transparent border border-neon-purple/20 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-neon-purple" />
                <span className="text-[13px] font-mono font-bold text-neon-purple">Strategic Insight</span>
              </div>
              <p className="text-[13px] leading-relaxed text-white/90">{researchData.insight}</p>
            </div>
          </div>

          {/* Playbook Section */}
          <div className="glass rounded-xl p-5 border border-white/10 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold flex items-center gap-2"><BookOpen className="w-4 h-4 text-neon-cyan" /> Interview Playbook</h3>
              {!playbookData && (
                <button 
                  onClick={() => playbookMutation.mutate(researchData.name)}
                  disabled={playbookMutation.isPending}
                  className="h-8 px-3 rounded-lg bg-neon-cyan/20 text-neon-cyan text-xs font-semibold hover:bg-neon-cyan/30 transition flex items-center gap-1.5"
                >
                  {playbookMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                  Generate Playbook
                </button>
              )}
            </div>

            {!playbookData && !playbookMutation.isPending && (
              <div className="flex-1 grid place-items-center text-center p-6 border-2 border-dashed border-white/10 rounded-xl bg-black/20">
                <div>
                  <Brain className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Synthesize cultural values, historical questions, and product launches to crush the interview.</p>
                </div>
              </div>
            )}
            
            {playbookMutation.isPending && (
              <div className="flex-1 grid place-items-center text-center p-6 border-2 border-dashed border-white/10 rounded-xl bg-black/20">
                <div>
                  <Loader2 className="w-8 h-8 animate-spin text-neon-purple mx-auto mb-2" />
                  <p className="font-mono text-sm text-neon-purple">Mining Glassdoor & Blind...</p>
                </div>
              </div>
            )}

            {playbookData && (
              <div className="space-y-4 animate-fade-up">
                <div>
                  <h4 className="text-xs font-mono text-neon-cyan mb-1.5 uppercase tracking-wider">Cultural Anchors</h4>
                  <ul className="space-y-1.5">
                    {playbookData.cultural_values.map((v: string, i: number) => (
                      <li key={i} className="text-[13px] flex items-start gap-2 text-white/80">
                        <Check className="w-3.5 h-3.5 mt-0.5 text-neon-green shrink-0" />
                        <span className="leading-snug">{v}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h4 className="text-xs font-mono text-neon-purple mb-1.5 uppercase tracking-wider">Historical Technical Questions</h4>
                  <div className="space-y-2">
                    {playbookData.technical_questions.map((q: any, i: number) => (
                      <div key={i} className="bg-white/5 rounded-lg p-2.5 border border-white/5">
                        <div className="text-[11px] font-mono text-muted-foreground mb-1">{q.stage}</div>
                        <div className="text-[13px] leading-snug">{q.question}</div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="text-xs font-mono text-neon-blue mb-1.5 uppercase tracking-wider">Recent Launches (Drop these)</h4>
                  <div className="flex flex-wrap gap-2">
                    {playbookData.product_launches.map((p: string, i: number) => (
                      <span key={i} className="text-[12px] px-2 py-1 rounded bg-neon-blue/10 text-neon-blue border border-neon-blue/20">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {!researchData && !researchMutation.isPending && (
        <div className="py-12 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-white/5 rounded-xl bg-black/10 mt-4">
          <Microscope className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm font-medium">Enter a company name above to begin OSINT collection.</p>
        </div>
      )}
    </section>
  );
}

/* ------------------------------ ANALYTICS ------------------------------ */

function Analytics() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats-detailed"],
    queryFn: async () => {
      const res = await apiFetch("/api/stats");
      if (!res.ok) return null;
      return res.json();
    }
  });

  const weeks = [42, 58, 51, 74, 68, 89, 96, 112, 108, 132, 145, 168];
  const maxW = Math.max(...weeks);
  
  const applied = stats?.applied || 0;
  const approved = stats?.approved || 0;
  // Convert approved -> interview conversion proxy since interview rate isnt strictly tracked yet
  const interviewRate = applied > 0 ? ((approved / applied) * 100).toFixed(1) : "0.0";
  const dashLength = applied > 0 ? (approved / applied) * 2 * Math.PI * 66 : 0;
  
  const sourcesObj = stats?.sources || {};
  const totalSources = Object.values(sourcesObj).reduce((a: any, b: any) => a + b, 0) || 1;
  const sortedSources = Object.entries(sourcesObj)
    .sort((a: any, b: any) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count], i) => ({
      name: name === 'secret' ? 'Secret Source' : name,
      pct: Math.round(((count as number) / (totalSources as number)) * 100),
      color: ["blue", "cyan", "purple", "pink", "green"][i % 5]
    }));

  const scores = stats?.scores || [8,12,18,24,32,44,58,72,84,96,112,132,168,142,108,74,52,38,26,18];
  const maxScore = Math.max(...scores, 1);

  return (
    <section className="grid xl:grid-cols-3 gap-4">
      <div className="glass-strong rounded-2xl p-6 xl:col-span-2">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-[13px] font-mono text-neon-blue mb-1">Analytics</div>
            <h2 className="text-xl font-bold">Applications per Week</h2>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-neon-cyan text-glow-cyan">{weeks[weeks.length-1]}</span>
            <span className="text-xs font-mono text-neon-green">+18.2%</span>
          </div>
        </div>
        <div className="relative h-56">
          <svg viewBox="0 0 600 220" className="w-full h-full overflow-visible" preserveAspectRatio="none">
            <defs>
              <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.72 0.19 255)" stopOpacity="0.5" />
                <stop offset="100%" stopColor="oklch(0.72 0.19 255)" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="lineStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="oklch(0.85 0.16 200)" />
                <stop offset="100%" stopColor="oklch(0.68 0.24 305)" />
              </linearGradient>
            </defs>
            {[0, 1, 2, 3].map((i) => (
              <line key={i} x1="0" x2="600" y1={i * 55 + 5} y2={i * 55 + 5} className="stroke-white/5" strokeDasharray="4 6" />
            ))}
            {(() => {
              const pts = weeks.map((v, i) => `${(i / (weeks.length - 1)) * 600},${200 - (v / maxW) * 180}`).join(" ");
              return (
                <>
                  <polygon points={`0,220 ${pts} 600,220`} fill="url(#areaFill)" />
                  <polyline points={pts} fill="none" stroke="url(#lineStroke)" strokeWidth="2.5" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 6px oklch(0.85 0.16 200 / 0.6))" }} />
                  {weeks.map((v, i) => (
                    <circle key={i} cx={(i / (weeks.length - 1)) * 600} cy={200 - (v / maxW) * 180} r="3" className="fill-neon-cyan" style={{ filter: "drop-shadow(0 0 4px currentColor)" }} />
                  ))}
                </>
              );
            })()}
          </svg>
        </div>
        <div className="mt-3 grid grid-cols-12 text-[12px] font-mono text-muted-foreground">
          {["W1","W2","W3","W4","W5","W6","W7","W8","W9","W10","W11","W12"].map((w) => (
            <div key={w} className="text-center">{w}</div>
          ))}
        </div>
      </div>

      <div className="glass-strong rounded-2xl p-6 flex flex-col">
        <div className="text-[13px] font-mono text-neon-purple mb-1">Conversion</div>
        <h2 className="text-xl font-bold mb-6">Approval Rate</h2>
        <div className="relative flex-1 grid place-items-center">
          <svg viewBox="0 0 160 160" className="w-44 h-44 -rotate-90">
            <circle cx="80" cy="80" r="66" strokeWidth="10" fill="none" className="stroke-white/5" />
            <circle
              cx="80" cy="80" r="66" strokeWidth="10" fill="none" strokeLinecap="round"
              className="stroke-neon-cyan"
              strokeDasharray={`${dashLength} ${2 * Math.PI * 66}`}
              style={{ filter: "drop-shadow(0 0 10px currentColor)" }}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="text-4xl font-bold font-mono text-neon-cyan">{interviewRate}%</div>
              <div className="text-[12px] font-mono text-muted-foreground mt-1">app → approved</div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/5">
          {[["Found", stats?.discovered || 0, "purple"], ["Applied", applied, "blue"], ["Approved", approved, "cyan"]].map(([l, v, c]) => (
            <div key={l as string} className="text-center">
              <div className={`text-lg font-bold font-mono ${COLOR_MAP[c as string].text}`}>{v as string}</div>
              <div className="text-[13px] font-mono text-muted-foreground">{l as string}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-strong rounded-2xl p-6">
        <div className="text-[13px] font-mono text-neon-cyan mb-1">Source Mix</div>
        <h2 className="text-lg font-bold mb-4">Job Source Effectiveness</h2>
        <div className="space-y-3">
          {sortedSources.length === 0 ? <p className="text-muted-foreground text-sm">No data available.</p> : sortedSources.map((s) => (
            <div key={s.name}>
              <div className="flex justify-between text-xs mb-1">
                <span className="capitalize">{s.name}</span>
                <span className={`font-mono ${COLOR_MAP[s.color].text}`}>{s.pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className={`h-full ${COLOR_MAP[s.color].text.replace("text-", "bg-")}`} style={{ width: `${s.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-strong rounded-2xl p-6 xl:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[13px] font-mono text-neon-purple mb-1">Distribution</div>
            <h2 className="text-lg font-bold">Match Score Histogram</h2>
          </div>
          <div className="flex gap-3 text-[12px] font-mono">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-neon-green" />90%+</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-neon-blue" />75–89%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-neon-amber" />60–74%</span>
          </div>
        </div>
        <div className="flex items-end gap-1.5 h-40">
          {scores.map((v: number, i: number) => {
            const color = i > 15 ? "bg-neon-green" : i > 8 ? "bg-neon-blue" : "bg-neon-amber";
            const glow = i > 15 ? "shadow-[0_0_12px_oklch(0.82_0.2_155/0.6)]" : i > 8 ? "shadow-[0_0_12px_oklch(0.72_0.19_255/0.6)]" : "";
            return (
              <div key={i} className={`flex-1 ${color} ${glow} rounded-t opacity-90 hover:opacity-100 transition`} style={{ height: `${maxScore === 0 ? 0 : (v / maxScore) * 100}%` }} />
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-[12px] font-mono text-muted-foreground">
          <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ TELEGRAM PANEL ------------------------------ */

const TG_MESSAGES = [
  { type: "alert",   icon: Radar,      text: "3 new 90%+ matches from Nyx Robotics, Vector Systems, Halo.", time: "2m", accent: "cyan" },
  { type: "approval", icon: FileEdit,  text: "Resume v3 ready for review — Staff ML Engineer @ Nyx.", time: "8m", accent: "purple", action: true },
  { type: "confirm", icon: Check,      text: "Auto-applied to 4 roles. All received 200 OK.", time: "24m", accent: "green" },
  { type: "outreach", icon: Mail,      text: "Cold email drafted for CTO @ Vector. Awaiting your send-off.", time: "1h", accent: "blue" },
];

function TelegramPanel() {
  return (
    <section className="glass-strong rounded-2xl p-6 relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
      <div className="relative grid lg:grid-cols-[280px_1fr] gap-8 items-center">
        {/* Phone mockup */}
        <div className="mx-auto">
          <div className="relative w-64 h-[520px] rounded-[42px] bg-gradient-to-b from-white/10 to-white/5 border border-white/15 p-2 glow-blue">
            <div className="w-full h-full rounded-[36px] bg-[#0B1020] overflow-hidden relative">
              <div className="absolute top-0 inset-x-0 h-6 flex justify-center items-end pb-1">
                <div className="w-20 h-4 rounded-full bg-black/60" />
              </div>
              <div className="pt-8 px-3">
                <div className="flex items-center gap-2 pb-3 border-b border-white/5">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neon-blue to-neon-purple grid place-items-center">
                    <Ghost className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold">Ghost Protocol Bot</div>
                    <div className="text-[13px] font-mono text-neon-green flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-neon-green" /> online
                    </div>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {TG_MESSAGES.slice(0, 3).map((m, i) => {
                    const c = COLOR_MAP[m.accent];
                    const Icon = m.icon;
                    return (
                      <div key={i} className={`glass rounded-2xl rounded-tl-sm p-2.5 animate-fade-up`} style={{ animationDelay: `${i * 120}ms` }}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon className={`w-3 h-3 ${c.text}`} />
                          <span className="text-[13px] font-mono text-muted-foreground">{m.type}</span>
                          <span className="ml-auto text-[13px] font-mono text-muted-foreground">{m.time}</span>
                        </div>
                        <p className="text-[12px] leading-snug">{m.text}</p>
                        {m.action && (
                          <div className="mt-2 flex gap-1">
                            <button className="flex-1 h-6 text-[13px] font-bold rounded-md bg-neon-green/20 text-neon-green">Approve</button>
                            <button className="flex-1 h-6 text-[13px] font-bold rounded-md bg-white/5">Revise</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="glass rounded-2xl rounded-tl-sm p-2.5 max-w-[85%]">
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse-glow" />
                      <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse-glow" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse-glow" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="text-[13px] font-mono text-neon-cyan mb-1">Telegram Control Panel</div>
          <h2 className="text-2xl font-bold mb-2">Mission Control in your Pocket</h2>
          <p className="text-muted-foreground text-sm max-w-lg mb-6">
            Approve resumes, greenlight applications, and receive high-signal alerts — all from a secure Telegram bridge. Zero-latency ops from anywhere.
          </p>

          <div className="space-y-2 max-w-lg">
            {TG_MESSAGES.map((m, i) => {
              const c = COLOR_MAP[m.accent];
              const Icon = m.icon;
              return (
                <div key={i} className="glass rounded-xl p-3 flex items-center gap-3 hover:bg-white/[0.06] transition">
                  <div className={`w-9 h-9 rounded-lg glass grid place-items-center ${c.text} shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-mono text-muted-foreground">{m.type}</span>
                      <span className="text-[12px] font-mono text-muted-foreground">· {m.time} ago</span>
                    </div>
                    <p className="text-sm mt-0.5 truncate">{m.text}</p>
                  </div>
                  <Circle className={`w-2 h-2 fill-current ${c.text} shrink-0`} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ MAIN ------------------------------ */

function GhostProtocolDashboard() {
  return (
    <Layout>
      <HeroStats />
      <AgentPipeline />
      <div className="grid xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <JobFeed />
        </div>
        <div className="glass-strong rounded-2xl p-6">
          <div className="text-[13px] font-mono text-neon-pink mb-1">Live Feed</div>
          <h2 className="text-xl font-bold mb-5">Agent Activity Stream</h2>
          <div className="relative space-y-4">
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gradient-to-b from-neon-cyan via-neon-purple to-transparent" />
            {[
              { t: "Discovery", m: "Ingested 42 new roles from Wellfound", time: "just now", c: "cyan" },
              { t: "Ranking",   m: "Scored 128 jobs · 3 above 90%", time: "1m", c: "blue" },
              { t: "Research",  m: "Compiled dossier: Nyx Robotics", time: "2m", c: "purple" },
              { t: "Resume",    m: "Generated v3 for Staff ML role", time: "4m", c: "pink" },
              { t: "ATS",       m: "Optimized keyword coverage → 94%", time: "6m", c: "cyan" },
              { t: "Application", m: "Submitted 4 applications · all ✓", time: "12m", c: "green" },
              { t: "Discovery", m: "New Y Combinator batch indexed", time: "18m", c: "cyan" },
            ].map((e, i) => {
              const c = COLOR_MAP[e.c];
              return (
                <div key={i} className="relative pl-10 animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                  <div className={`absolute left-0 top-0.5 w-8 h-8 rounded-lg glass grid place-items-center ${c.text}`}>
                    <Circle className="w-2 h-2 fill-current" />
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`text-[12px] font-mono ${c.text}`}>{e.t}</span>
                    <span className="text-[12px] font-mono text-muted-foreground">{e.time}</span>
                  </div>
                  <p className="text-xs mt-0.5">{e.m}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      <Analytics />
      <TelegramPanel />

      <footer className="pt-6 pb-8 flex items-center justify-between flex-wrap gap-3 border-t border-white/5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Ghost className="w-4 h-4 text-neon-cyan" />
          <span className="font-mono">Ghost Protocol Engine · v3.2.1 · Autonomous Runtime</span>
        </div>
        <div className="flex items-center gap-4 text-[12px] font-mono text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse-glow" /> All systems nominal</span>
          <span>Uptime 99.998%</span>
          <span>Latency 12ms</span>
        </div>
      </footer>
    </Layout>
  );
}
