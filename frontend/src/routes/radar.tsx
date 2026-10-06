import { createFileRoute } from "@tanstack/react-router";
import { AuthGuard } from "../components/AuthGuard";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import { Loader2, DollarSign, MapPin, Sparkles, Target, ExternalLink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/radar")({
  component: RadarPageWrapper,
});

function scoreStyle(s: number) {
  if (s >= 90) return { color: "text-neon-green", ring: "stroke-neon-green", bg: "bg-neon-green/10 border-neon-green/30" };
  if (s >= 75) return { color: "text-neon-blue",  ring: "stroke-neon-blue",  bg: "bg-neon-blue/10 border-neon-blue/30" };
  return { color: "text-neon-amber", ring: "stroke-neon-amber", bg: "bg-neon-amber/10 border-neon-amber/30" };
}

function RadarPageWrapper() {
  return (
    <AuthGuard>
      <RadarPage />
    </AuthGuard>
  );
}

function RadarPage() {
  const queryClient = useQueryClient();
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["leads", "Found"],
    initialPageParam: "",
    queryFn: async ({ pageParam = "" }) => {
      const url = new URL("/api/leads", window.location.origin);
      url.searchParams.set("status", "Found");
      if (pageParam) url.searchParams.set("cursor", pageParam);
      url.searchParams.set("limit", "10");
      const res = await apiFetch(url.pathname + url.search);
      if (!res.ok) throw new Error("Failed to fetch leads");
      return res.json();
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage || lastPage.length < 10) return undefined;
      return lastPage[lastPage.length - 1].created_at;
    }
  });

  const leads = data?.pages.flatMap(page => page) || [];

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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
  });

  const handleGenerate = async (job: any) => {
    setGeneratingFor(job.job_id);
    try {
      // Trigger a status update to 'Tailored' to remove it from 'New' feed
      // In reality, we should hit a dedicated /api/leads/:id/resume endpoint.
      // Since this is a UI prototype, we'll just mock the completion for now and dismiss it.
      await new Promise(r => setTimeout(r, 2000));
      toast.success("Resume generated and sent to your Telegram!");
      statusMutation.mutate({ id: job.job_id, status: 'Tailored' });
    } catch (e) {
      toast.error("Generation failed");
    } finally {
      setGeneratingFor(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-white/5 p-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-unbounded bg-gradient-to-r from-neon-blue to-neon-purple bg-clip-text text-transparent">
            PhantmOS Radar
          </h1>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">
            {leads.length} pending opportunities
          </p>
        </div>
      </div>

      {/* Feed */}
      <div className="p-4 space-y-4 max-w-md mx-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin mb-3 text-neon-cyan" />
            <p className="font-mono text-sm">Scanning radar...</p>
          </div>
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-black/20 rounded-xl border border-dashed border-white/10">
            <Target className="w-10 h-10 mb-3 opacity-50" />
            <p className="text-sm font-medium text-white">Radar Clear</p>
            <p className="text-xs mt-1 text-center px-4">All opportunities reviewed. Wait for the next pipeline run.</p>
          </div>
        ) : (
          leads.map((job: any) => {
            const s = scoreStyle(job.score_total || 0);
            return (
              <div key={job.job_id} className="glass rounded-2xl overflow-hidden animate-fade-up flex flex-col">
                <div className="p-5 flex-1">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg leading-tight truncate">{job.title}</h3>
                      <div className="text-sm text-neon-cyan mt-1 truncate">{job.company}</div>
                    </div>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-mono font-bold text-sm shrink-0 border ${s.bg} ${s.color}`}>
                      {job.score_total || 0}
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-4">
                    {job.salary && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3"/>{job.salary}</span>}
                    {job.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/>{job.location}</span>}
                  </div>
                  
                  <div className={`p-3 rounded-xl border ${s.bg} bg-black/40`}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Sparkles className={`w-3.5 h-3.5 ${s.color}`} />
                      <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">AI Assessment</span>
                    </div>
                    <p className="text-sm leading-relaxed line-clamp-4">{job.justification || "Awaiting intelligence processing."}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-px bg-white/5 border-t border-white/5">
                  <button 
                    onClick={() => statusMutation.mutate({ id: job.job_id, status: 'Dismissed' })}
                    disabled={statusMutation.isPending || generatingFor === job.job_id}
                    className="p-4 text-sm font-medium text-muted-foreground hover:bg-white/5 hover:text-white transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    🗑️ Skip
                  </button>
                  <button 
                    onClick={() => handleGenerate(job)}
                    disabled={statusMutation.isPending || generatingFor === job.job_id}
                    className="p-4 text-sm font-bold text-neon-blue hover:bg-neon-blue/10 transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {generatingFor === job.job_id ? (
                      <><Loader2 className="w-4 h-4 animate-spin"/> Generating...</>
                    ) : (
                      <>📄 Create Resume</>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
        
        {hasNextPage && (
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="w-full py-4 rounded-xl glass text-sm font-medium flex items-center justify-center gap-2"
          >
            {isFetchingNextPage ? <Loader2 className="w-4 h-4 animate-spin"/> : "Load More"}
          </button>
        )}
      </div>
    </div>
  );
}
