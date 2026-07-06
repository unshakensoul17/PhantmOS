import { apiFetch } from "../lib/api";
import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "../components/Layout";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Radar, Target, Zap, DollarSign, MapPin, Sparkles, 
  Check, X, Loader2, ArrowUpRight, Search
} from "lucide-react";
import { useState } from "react";
import { AgentPipeline } from "../components/AgentPipeline";

export const Route = createFileRoute("/job-discovery")({
  component: JobDiscoveryPage,
});

function scoreStyle(s: number) {
  if (s >= 90) return { color: "text-neon-green", ring: "stroke-neon-green", bg: "bg-neon-green/10 border-neon-green/30" };
  if (s >= 75) return { color: "text-neon-blue",  ring: "stroke-neon-blue",  bg: "bg-neon-blue/10 border-neon-blue/30" };
  return { color: "text-neon-amber", ring: "stroke-neon-amber", bg: "bg-neon-amber/10 border-neon-amber/30" };
}

function JobDiscoveryPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showPipeline, setShowPipeline] = useState(false);

  const { 
    data, 
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteQuery({
    queryKey: ["leads", filterStatus],
    initialPageParam: "",
    queryFn: async ({ pageParam = "" }) => {
      const url = new URL("/api/leads", window.location.origin);
      if (filterStatus) url.searchParams.set("status", filterStatus);
      if (pageParam) url.searchParams.set("cursor", pageParam);
      url.searchParams.set("limit", "20");
      
      const res = await apiFetch(url.pathname + url.search);
      if (!res.ok) throw new Error("Failed to fetch leads");
      return res.json();
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage || lastPage.length < 20) return undefined;
      return lastPage[lastPage.length - 1].created_at;
    }
  });

  const leads = data?.pages.flatMap(page => page) || [];

  const harvestMutation = useMutation({
    mutationFn: async (query: string) => {
      setShowPipeline(true);
      const res = await apiFetch("/api/harvest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) throw new Error("Failed to trigger harvest");
      return res.json();
    },
    onSettled: () => {
      // Hide the pipeline 15 seconds after the harvest completes (or fails)
      setTimeout(() => setShowPipeline(false), 15000);
    }
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiFetch(`/api/leads/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  return (
    <Layout>
      <div className="space-y-6 animate-fade-up">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
          <div>
            <div className="text-[13px] font-mono text-neon-cyan mb-1">Intelligence Feed</div>
            <h2 className="text-3xl font-bold tracking-tight">Job Discovery Engine</h2>
          </div>
        </div>

        {/* Action Panel */}
        <div className="glass-strong rounded-2xl p-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full space-y-1.5">
              <label className="text-xs font-mono text-neon-blue">Target Role / Query</label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. Senior Machine Learning Engineer in San Francisco"
                  className="w-full h-11 pl-10 pr-4 rounded-xl glass text-sm focus:outline-none focus:ring-2 focus:ring-neon-blue/50 transition bg-black/20"
                />
              </div>
            </div>
            <button 
              onClick={() => harvestMutation.mutate(searchQuery)}
              disabled={harvestMutation.isPending}
              className="h-11 px-6 rounded-xl bg-gradient-to-r from-neon-blue to-neon-purple text-black font-semibold inline-flex items-center gap-2 hover:scale-[1.02] transition glow-blue disabled:opacity-50 disabled:hover:scale-100 shrink-0"
            >
              {harvestMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
              {harvestMutation.isPending ? "Harvesting..." : "Run Discovery Engine"}
            </button>
          </div>

          {showPipeline && <AgentPipeline inline />}
          
          {harvestMutation.isSuccess && (
            <div className="mt-4 p-3 rounded-lg bg-neon-green/10 border border-neon-green/20 text-neon-green text-sm flex items-center gap-2">
              <Check className="w-4 h-4" /> Pipeline triggered successfully! Agents are now scanning sources.
            </div>
          )}
        </div>

        {/* Feed section */}
        <div className="glass-strong rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <h3 className="text-xl font-bold">High-Signal Opportunities</h3>
            <div className="flex gap-1 p-1 rounded-lg glass text-xs">
              {["All", "Found", "Tailored", "Approved", "Dismissed"].map((t) => {
                const filterVal = t === "All" ? "" : t;
                const isActive = filterStatus === filterVal;
                return (
                  <button 
                    key={t}
                    onClick={() => setFilterStatus(filterVal)}
                    className={`px-3 py-1.5 rounded-md font-medium transition ${isActive ? "bg-neon-blue/20 text-neon-cyan" : "text-muted-foreground hover:text-white"}`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mb-3 text-neon-cyan" />
              <p className="font-mono text-sm">Loading intelligence feed...</p>
            </div>
          ) : leads?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground bg-black/20 rounded-xl border border-dashed border-white/10">
              <Target className="w-10 h-10 mb-3 opacity-50" />
              <p className="text-sm font-medium text-white">No opportunities found.</p>
              <p className="text-xs mt-1">Run the discovery engine to find new roles.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {leads?.map((job: any, index: number) => {
                const s = scoreStyle(job.score_total || 0);
                const circ = 2 * Math.PI * 20;
                const dash = ((job.score_total || 0) / 100) * circ;
                
                return (
                  <div
                    key={job.job_id}
                    className="group relative glass rounded-xl p-4 flex items-center gap-4 hover:bg-white/[0.07] transition-all flex-wrap md:flex-nowrap"
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
                        {job.score_total || 0}
                      </div>
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
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-white/10 text-muted-foreground uppercase">{job.status}</span>
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
                        <Sparkles className={`w-3 h-3 ${s.color}`} />
                        <span className="text-[13px] font-mono text-muted-foreground">AI Assessment</span>
                      </div>
                      <p className="text-[13px] leading-snug line-clamp-2">{job.justification || "Awaiting AI Assessment..."}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {job.status !== 'Approved' && job.status !== 'Applied' && (
                        <button 
                          onClick={() => statusMutation.mutate({ id: job.job_id, status: 'Approved' })}
                          className="h-9 px-3 rounded-lg bg-neon-green/10 text-neon-green hover:bg-neon-green/20 text-xs font-medium inline-flex items-center gap-1.5 transition"
                        >
                          <Check className="w-3.5 h-3.5" /> Approve
                        </button>
                      )}
                      
                      {job.status !== 'Dismissed' && (
                        <button 
                          onClick={() => statusMutation.mutate({ id: job.job_id, status: 'Dismissed' })}
                          className="h-9 px-3 rounded-lg glass hover:bg-white/10 text-muted-foreground hover:text-white text-xs font-medium inline-flex items-center gap-1.5 transition"
                        >
                          <X className="w-3.5 h-3.5" /> Dismiss
                        </button>
                      )}
                      
                      <a 
                        href={job.url || job.job_url || "#"} 
                        target="_blank" 
                        rel="noreferrer"
                        className="h-9 px-3 rounded-lg bg-gradient-to-r from-neon-blue to-neon-purple text-black text-xs font-semibold inline-flex items-center gap-1.5 hover:scale-[1.02] transition"
                      >
                        Apply <ArrowUpRight className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {hasNextPage && (
            <div className="mt-8 flex justify-center">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="px-6 py-2.5 rounded-xl glass text-sm font-medium hover:bg-white/5 transition flex items-center gap-2"
              >
                {isFetchingNextPage ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Loading...</>
                ) : (
                  'Load More Leads'
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
