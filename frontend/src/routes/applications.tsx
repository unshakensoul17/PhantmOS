import { apiFetch } from "../lib/api";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout } from "../components/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Building2, MapPin, DollarSign, Loader2, ArrowRight, 
  Send, Sparkles, CheckCircle2, XCircle, FileText, ArrowUpRight,
  Inbox, Search, Filter, Briefcase, Trophy, Clock, CheckCircle,
  TrendingUp, RefreshCw, ChevronRight, MoreHorizontal, ExternalLink
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/applications")({
  component: ApplicationsPage,
});

const COLUMNS = [
  { 
    id: "Saved", 
    label: "Saved", 
    emptyHint: "Save jobs to review later"
  },
  { 
    id: "Approved", 
    label: "Ready to Apply", 
    emptyHint: "Tailored resumes ready"
  },
  { 
    id: "Applied", 
    label: "Applied", 
    emptyHint: "Applications submitted"
  },
  { 
    id: "Interviewing", 
    label: "Interview", 
    emptyHint: "Interviews scheduled"
  },
  { 
    id: "Offer", 
    label: "Offer", 
    emptyHint: "Job offers received"
  },
  { 
    id: "Rejected", 
    label: "Rejected", 
    emptyHint: "Closed opportunities"
  },
];

function ApplicationsPage() {
  const queryClient = useQueryClient();
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [emailDraft, setEmailDraft] = useState<string | null>(null);
  const [targetEmail, setTargetEmail] = useState("");
  const [outreachType, setOutreachType] = useState<"email" | "cover_letter">("email");
  const [outreachTone, setOutreachTone] = useState<"Simple" | "Friendly" | "Professional">("Professional");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterColumn, setFilterColumn] = useState<string>("ALL");

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const res = await apiFetch("/api/leads?limit=200");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30000,
  });

  const apps = useMemo(() => {
    return leads.filter((l: any) => 
      ["Saved", "Approved", "Applied", "Interviewing", "Offer", "Rejected"].includes(l.status)
    );
  }, [leads]);

  const filteredApps = useMemo(() => {
    return apps.filter((app: any) => {
      const matchesSearch = searchQuery.trim() === "" || 
        app.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.location?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCol = filterColumn === "ALL" || app.status === filterColumn;
      return matchesSearch && matchesCol;
    });
  }, [apps, searchQuery, filterColumn]);

  const stats = useMemo(() => {
    const total = apps.length;
    const applied = apps.filter((a: any) => a.status === "Applied").length;
    const interviews = apps.filter((a: any) => a.status === "Interviewing").length;
    const offers = apps.filter((a: any) => a.status === "Offer").length;
    const ready = apps.filter((a: any) => a.status === "Approved").length;
    return { total, applied, interviews, offers, ready };
  }, [apps]);

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
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Application status updated");
    },
  });

  const phantmWriterMutation = useMutation({
    mutationFn: async (job: any) => {
      setSelectedJob(job);
      const res = await apiFetch(`/api/applications/phantm-writer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: job.job_id || job.id, company: job.company, role: job.title }),
      });
      if (!res.ok) throw new Error("Failed to generate outreach");
      return res.json();
    },
    onSuccess: (data) => {
      setEmailDraft(data.email);
      if (data.target_email) {
        setTargetEmail(data.target_email);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to generate outreach");
    }
  });

  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      if (!selectedJob || !emailDraft || !targetEmail) return;
      const res = await apiFetch(`/api/applications/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: selectedJob.job_id || selectedJob.id,
          target_email: targetEmail,
          email_text: emailDraft
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || "Failed to send email");
      }
      return res.json();
    },
    onSuccess: () => {
      setEmailDraft(null);
      setSelectedJob(null);
      setTargetEmail("");
      toast.success("Outreach email sent successfully!");
    },
    onError: (err: any) => {
      toast.error(err.message);
    }
  });

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">My Applications</h1>
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 font-semibold">
                {apps.length} Jobs
              </span>
            </div>
            <p className="text-sm text-zinc-400 mt-1">
              Kanban tracker for every stage of your job pipeline — from saved leads to offers.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
            <div className="bg-zinc-950/80 border border-zinc-850 rounded-2xl px-3.5 py-2.5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                <Briefcase className="w-4 h-4" />
              </div>
              <div>
                <span className="text-base font-bold text-white block font-mono leading-tight">{stats.total}</span>
                <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Tracked</span>
              </div>
            </div>

            <div className="bg-zinc-950/80 border border-zinc-850 rounded-2xl px-3.5 py-2.5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                <Send className="w-4 h-4" />
              </div>
              <div>
                <span className="text-base font-bold text-white block font-mono leading-tight">{stats.applied}</span>
                <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Applied</span>
              </div>
            </div>

            <div className="bg-zinc-950/80 border border-zinc-850 rounded-2xl px-3.5 py-2.5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <span className="text-base font-bold text-white block font-mono leading-tight">{stats.interviews}</span>
                <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Interviews</span>
              </div>
            </div>

            <div className="bg-zinc-950/80 border border-zinc-850 rounded-2xl px-3.5 py-2.5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                <Trophy className="w-4 h-4" />
              </div>
              <div>
                <span className="text-base font-bold text-white block font-mono leading-tight">{stats.offers}</span>
                <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Offers</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-zinc-950/70 border border-zinc-850 p-3 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by role, company, or city..."
              className="w-full h-9 pl-9 pr-4 rounded-xl bg-black border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setFilterColumn("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition ${
                filterColumn === "ALL"
                  ? "bg-white text-black font-semibold shadow-sm"
                  : "bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-850 border border-zinc-800"
              }`}
            >
              All ({apps.length})
            </button>
            {COLUMNS.map((col) => {
              const count = apps.filter((a: any) => a.status === col.id).length;
              const isActive = filterColumn === col.id;
              return (
                <button
                  key={col.id}
                  onClick={() => setFilterColumn(isActive ? "ALL" : col.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition flex items-center gap-1.5 ${
                    isActive
                      ? "bg-white text-black font-semibold shadow-sm"
                      : "bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-850 border border-zinc-800"
                  }`}
                >
                  <span>{col.label}</span>
                  <span className="text-[10px] opacity-70 font-mono">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Kanban Board Container */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4 items-start overflow-x-auto pb-4">
          {COLUMNS.map((col) => {
            const colApps = filteredApps.filter((a: any) => a.status === col.id);
            const totalColCount = apps.filter((a: any) => a.status === col.id).length;
            
            return (
              <div 
                key={col.id} 
                className="bg-zinc-950/90 border border-zinc-850 rounded-2xl p-3.5 min-h-[520px] flex flex-col transition duration-200 hover:border-zinc-750"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-900">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                    <span className="text-xs font-semibold text-zinc-200 tracking-tight">
                      {col.label}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-md bg-zinc-900 text-zinc-400 border border-zinc-800">
                    {colApps.length}
                  </span>
                </div>
                
                {/* Cards List */}
                <div className="space-y-3 flex-1 flex flex-col">
                  {colApps.map((job: any) => {
                    const matchScore = job.match_score || job.score || job.score_total;
                    const scorePct = matchScore ? (matchScore <= 1.0 ? Math.round(matchScore * 100) : Math.round(matchScore)) : null;

                    return (
                      <div 
                        key={job.job_id || job.id} 
                        className="group relative bg-black/90 hover:bg-zinc-900/70 rounded-xl p-3.5 transition-all duration-200 border border-zinc-850 hover:border-zinc-700 hover:shadow-lg shadow-black/40"
                      >
                        {/* Top info & Match score */}
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <h4 className="font-semibold text-xs text-white leading-snug line-clamp-2 group-hover:text-zinc-200 transition">
                            {job.title}
                          </h4>
                          {scorePct !== null && scorePct > 0 && (
                            <span className="shrink-0 text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-800">
                              {scorePct}% match
                            </span>
                          )}
                        </div>

                        {/* Company Name */}
                        <div className="text-xs font-medium text-zinc-300 flex items-center gap-1.5 mb-2">
                          <Building2 className="w-3 h-3 text-zinc-500 shrink-0" />
                          <span className="truncate">{job.company}</span>
                        </div>
                        
                        {/* Metadata Tags */}
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400 mb-3">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-zinc-500 shrink-0" /> 
                            <span className="truncate max-w-[110px]">{job.location || 'Remote'}</span>
                          </span>
                          {job.salary && (
                            <>
                              <span className="text-zinc-700">•</span>
                              <span className="flex items-center gap-0.5 font-mono text-zinc-300 text-[10px]">
                                {job.salary}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Actions per stage */}
                        <div className="pt-2 border-t border-zinc-900 space-y-1.5">
                          {job.status === 'Applied' && (
                            <button 
                              onClick={() => phantmWriterMutation.mutate(job)}
                              disabled={phantmWriterMutation.isPending}
                              className="w-full h-7 rounded-lg bg-zinc-900 hover:bg-zinc-850 text-zinc-200 text-xs font-medium transition flex items-center justify-center gap-1.5 border border-zinc-800"
                            >
                              <Sparkles className="w-3 h-3 text-zinc-400" />
                              <span>AI Follow-up</span>
                            </button>
                          )}

                          {job.status === 'Interviewing' && (
                            <Link 
                              to="/company-research" 
                              search={{ company: job.company }}
                              className="w-full h-7 rounded-lg bg-zinc-900 hover:bg-zinc-850 text-zinc-200 border border-zinc-800 text-xs font-medium transition flex items-center justify-center gap-1.5"
                            >
                              <FileText className="w-3 h-3 text-zinc-400" /> 
                              <span>Company Prep</span>
                            </Link>
                          )}

                          {/* Quick Stage Transitions */}
                          <div className="flex items-center gap-1.5 pt-1">
                            {job.status === 'Saved' && (
                              <button 
                                onClick={() => statusMutation.mutate({ id: job.job_id || job.id, status: 'Approved'})} 
                                className="flex-1 h-7 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-semibold transition inline-flex items-center justify-center gap-1 shadow-sm"
                              >
                                Ready to Apply <ArrowRight className="w-3 h-3" />
                              </button>
                            )}

                            {job.status === 'Approved' && (
                              <>
                                <button 
                                  onClick={() => statusMutation.mutate({ id: job.job_id || job.id, status: 'Applied'})} 
                                  className="flex-1 h-7 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-semibold transition inline-flex items-center justify-center gap-1 shadow-sm"
                                >
                                  Mark Applied <ArrowRight className="w-3 h-3" />
                                </button>
                                {(job.source_url || job.url) && (
                                  <a 
                                    href={job.source_url || job.url} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    className="h-7 px-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium inline-flex items-center justify-center border border-zinc-800 transition"
                                    title="Open job link"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </>
                            )}

                            {job.status === 'Applied' && (
                              <button 
                                onClick={() => statusMutation.mutate({ id: job.job_id || job.id, status: 'Interviewing'})} 
                                className="flex-1 h-7 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs font-medium transition inline-flex items-center justify-center gap-1"
                              >
                                Got Interview <ArrowRight className="w-3 h-3" />
                              </button>
                            )}

                            {job.status === 'Interviewing' && (
                              <>
                                <button 
                                  onClick={() => statusMutation.mutate({ id: job.job_id || job.id, status: 'Offer'})} 
                                  className="flex-1 h-7 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-semibold transition inline-flex items-center justify-center gap-1 shadow-sm"
                                >
                                  <CheckCircle2 className="w-3 h-3" /> Got Offer
                                </button>
                                <button 
                                  onClick={() => statusMutation.mutate({ id: job.job_id || job.id, status: 'Rejected'})} 
                                  className="h-7 px-2 rounded-lg hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 border border-zinc-800 text-xs transition"
                                  title="Mark as rejected"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}

                            {job.status === 'Offer' && (
                              <div className="w-full text-center py-1 text-[11px] font-semibold text-zinc-200 flex items-center justify-center gap-1">
                                <Trophy className="w-3 h-3 text-zinc-400" /> Offer Received
                              </div>
                            )}

                            {job.status === 'Rejected' && (
                              <button
                                onClick={() => statusMutation.mutate({ id: job.job_id || job.id, status: 'Approved'})}
                                className="w-full h-6 text-[11px] rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 transition"
                              >
                                Reopen Lead
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {colApps.length === 0 && (
                    <div className="flex-1 min-h-[220px] flex flex-col items-center justify-center text-center p-4 rounded-xl border border-dashed border-zinc-850/80 bg-black/40">
                      <div className="w-10 h-10 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-center mb-2 text-zinc-600">
                        <Inbox className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-medium text-zinc-400 mb-0.5">No jobs here</span>
                      <span className="text-[11px] text-zinc-600 max-w-[130px] leading-tight">
                        {col.emptyHint}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Write for Me Modal */}
      {emailDraft && selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-zinc-950 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl border border-zinc-800">
            <div className="flex items-center justify-between p-4 border-b border-zinc-900">
              <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
                <Sparkles className="w-4 h-4 text-white" />
                Write for Me
              </h3>
              <button 
                onClick={() => { setEmailDraft(null); setSelectedJob(null); }}
                className="p-1 hover:bg-zinc-900 rounded-lg text-zinc-400 hover:text-white transition"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div>
                <span className="text-xs text-zinc-400 block mb-0.5">Job</span>
                <span className="font-medium text-sm text-white">{selectedJob.title} @ {selectedJob.company}</span>
              </div>

              {/* Tone Selector */}
              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1.5">What tone do you want?</label>
                <div className="flex gap-2">
                  {(["Simple", "Friendly", "Professional"] as const).map((tone) => (
                    <button
                      key={tone}
                      type="button"
                      onClick={() => setOutreachTone(tone)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                        outreachTone === tone
                          ? "bg-white text-black font-semibold"
                          : "bg-black text-zinc-400 hover:text-white"
                      }`}
                    >
                      {tone}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Company Email</label>
                <input 
                  type="email"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  placeholder="recruiter@company.com"
                  className="w-full h-9 px-3 rounded-lg bg-black text-white text-xs border border-zinc-800 focus:border-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Generated Text</label>
                <textarea 
                  className="w-full h-44 p-3 rounded-lg bg-black text-zinc-200 text-xs leading-relaxed border border-zinc-800 focus:border-white focus:outline-none resize-none font-sans"
                  value={emailDraft}
                  onChange={(e) => setEmailDraft(e.target.value)}
                />
              </div>
            </div>

            <div className="p-4 bg-black/40 flex items-center justify-between border-t border-zinc-900">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(emailDraft);
                  toast.success("Copied to clipboard!");
                }}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-200 transition"
              >
                Copy
              </button>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => { setEmailDraft(null); setSelectedJob(null); setTargetEmail(""); }}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => sendEmailMutation.mutate()}
                  disabled={sendEmailMutation.isPending || !targetEmail}
                  className="px-4 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  {sendEmailMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Send Email
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
