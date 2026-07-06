import { apiFetch } from "../lib/api";
import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "../components/Layout";
import {
  Sparkles, Radar, Brain, Microscope, ShieldCheck, AlertTriangle, Check, BookOpen, Search, Loader2, Zap
} from "lucide-react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";

export const Route = createFileRoute("/company-research")({
  component: CompanyResearchPage,
});

function CompanyResearchPage() {
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
    <Layout>
      <div className="space-y-6 animate-fade-up">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
          <div>
            <div className="text-[13px] font-mono text-neon-cyan mb-1">Deep Dive OSINT</div>
            <h2 className="text-3xl font-bold tracking-tight">Company Research Engine</h2>
          </div>
        </div>

        <section className="glass-strong rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div>
              <h2 className="text-xl font-bold">Autonomous OSINT Scanner</h2>
              <p className="text-sm text-muted-foreground mt-1">Deploy an agent to extract tech stack, stability risks, and interview intel.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Target Company..."
                  className="h-11 pl-9 pr-4 rounded-xl glass text-sm focus:outline-none focus:ring-2 focus:ring-neon-blue/50 transition w-64 bg-black/20"
                />
              </div>
              <button 
                onClick={() => researchMutation.mutate(searchQuery)}
                disabled={!searchQuery || researchMutation.isPending}
                className="h-11 px-5 rounded-xl bg-gradient-to-r from-neon-blue to-neon-purple text-black text-sm font-semibold inline-flex items-center gap-2 hover:scale-[1.02] transition disabled:opacity-50"
              >
                {researchMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
                Scan Target
              </button>
            </div>
          </div>

          {researchMutation.isPending && (
            <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
              <div className="relative mb-6">
                <Radar className="w-12 h-12 text-neon-blue animate-pulse" />
                <div className="absolute inset-0 w-12 h-12 rounded-full border border-neon-blue animate-ping" />
              </div>
              <p className="font-mono text-sm text-neon-blue">Agents extracting tech stack and stability signals...</p>
            </div>
          )}

          {researchData && !researchMutation.isPending && (
            <div className="grid lg:grid-cols-2 gap-6 animate-fade-up mt-8">
              {/* OSINT Card */}
              <div className="glass rounded-xl p-6 border border-white/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-neon-cyan/5 rounded-full blur-3xl" />
                
                <div className="flex items-start justify-between mb-6 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-neon-blue/30 to-neon-purple/30 border border-white/10 grid place-items-center font-bold font-mono text-neon-cyan text-xl">
                      {researchData.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-2xl tracking-tight">{researchData.name}</div>
                      <div className="text-[14px] font-mono text-muted-foreground mt-0.5">{researchData.industry}</div>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1.5 text-[12px] font-mono px-3 py-1.5 rounded-lg border ${
                    researchData.stability.risk_label.includes("High") && !researchData.stability.risk_label.includes("Runway") 
                    ? "bg-neon-pink/10 text-neon-pink border-neon-pink/30"
                    : "bg-neon-green/10 text-neon-green border-neon-green/30"
                  }`}>
                    {researchData.stability.risk_label.includes("High") && !researchData.stability.risk_label.includes("Runway") ? <AlertTriangle className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />} 
                    {researchData.stability.risk_label}
                  </div>
                </div>

                <div className="mb-6 relative z-10">
                  <h4 className="text-[11px] font-mono text-neon-blue mb-2.5 uppercase tracking-wider font-semibold">Confirmed Tech Stack</h4>
                  <div className="flex flex-wrap gap-2">
                    {researchData.stack.map((t: string) => (
                      <span key={t} className="text-[13px] font-mono px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-white shadow-sm">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="relative pl-5 mb-6 z-10">
                  <div className="absolute left-1.5 top-2 bottom-2 w-[2px] bg-gradient-to-b from-neon-cyan via-neon-blue to-transparent" />
                  {researchData.news_timeline.map((n: string, j: number) => (
                    <div key={j} className="relative flex items-start gap-3 mb-3 last:mb-0">
                      <span className={`absolute -left-[22px] top-1.5 w-2 h-2 rounded-full ${j === 0 ? "bg-neon-cyan glow-cyan" : "bg-white/20"}`} />
                      <span className={`text-[14px] leading-relaxed ${j === 0 ? "text-white" : "text-muted-foreground"}`}>{n}</span>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl bg-gradient-to-br from-neon-purple/10 to-transparent border border-neon-purple/20 p-4 relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-neon-purple" />
                    <span className="text-[13px] font-mono font-bold text-neon-purple tracking-wide">AI Strategy Insight</span>
                  </div>
                  <p className="text-[14px] leading-relaxed text-white/90">{researchData.insight}</p>
                </div>
              </div>

              {/* Playbook Section */}
              <div className="glass rounded-xl p-6 border border-white/10 flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-neon-purple/5 rounded-full blur-3xl" />
                
                <div className="flex items-center justify-between mb-6 relative z-10">
                  <h3 className="font-bold flex items-center gap-2 text-lg"><BookOpen className="w-5 h-5 text-neon-cyan" /> Interview Playbook</h3>
                  {!playbookData && (
                    <button 
                      onClick={() => playbookMutation.mutate(researchData.name)}
                      disabled={playbookMutation.isPending}
                      className="h-9 px-4 rounded-lg bg-neon-cyan/20 text-neon-cyan text-xs font-semibold hover:bg-neon-cyan/30 transition flex items-center gap-2"
                    >
                      {playbookMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                      Generate Playbook
                    </button>
                  )}
                </div>

                {!playbookData && !playbookMutation.isPending && (
                  <div className="flex-1 grid place-items-center text-center p-8 border-2 border-dashed border-white/10 rounded-xl bg-black/20 relative z-10">
                    <div>
                      <Brain className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px] mx-auto">Click generate to synthesize cultural values, historical questions, and product launches to crush the interview.</p>
                    </div>
                  </div>
                )}
                
                {playbookMutation.isPending && (
                  <div className="flex-1 grid place-items-center text-center p-8 border-2 border-dashed border-white/10 rounded-xl bg-black/20 relative z-10">
                    <div>
                      <Loader2 className="w-10 h-10 animate-spin text-neon-purple mx-auto mb-3" />
                      <p className="font-mono text-sm text-neon-purple">Mining Glassdoor & Blind Data...</p>
                    </div>
                  </div>
                )}

                {playbookData && (
                  <div className="space-y-6 animate-fade-up relative z-10">
                    <div>
                      <h4 className="text-[11px] font-mono text-neon-cyan mb-2 uppercase tracking-wider font-semibold">Cultural Anchors</h4>
                      <ul className="space-y-2">
                        {playbookData.cultural_values.map((v: string, i: number) => (
                          <li key={i} className="text-[13px] flex items-start gap-2.5 text-white/90 bg-white/5 p-2 rounded-lg">
                            <Check className="w-4 h-4 mt-0.5 text-neon-green shrink-0" />
                            <span className="leading-relaxed">{v}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div>
                      <h4 className="text-[11px] font-mono text-neon-purple mb-2 uppercase tracking-wider font-semibold">Historical Technical Questions</h4>
                      <div className="space-y-2.5">
                        {playbookData.technical_questions.map((q: any, i: number) => (
                          <div key={i} className="bg-black/20 rounded-lg p-3 border border-white/5 shadow-inner">
                            <div className="text-[11px] font-mono text-neon-purple/80 mb-1.5 font-semibold">{q.stage}</div>
                            <div className="text-[13px] leading-relaxed">{q.question}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-[11px] font-mono text-neon-blue mb-2 uppercase tracking-wider font-semibold">Recent Launches (Mention These)</h4>
                      <div className="flex flex-wrap gap-2">
                        {playbookData.product_launches.map((p: string, i: number) => (
                          <span key={i} className="text-[12px] px-2.5 py-1.5 rounded-lg bg-neon-blue/10 text-neon-blue border border-neon-blue/20">
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
            <div className="py-20 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-white/5 rounded-xl bg-black/10 mt-6">
              <Microscope className="w-12 h-12 mb-4 opacity-30" />
              <p className="text-sm font-medium">Enter a company name above to begin deep OSINT collection.</p>
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
