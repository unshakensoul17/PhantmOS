import { apiFetch } from "../lib/api";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout } from "../components/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Building2, MapPin, DollarSign, Loader2, ArrowRight, 
  Send, Sparkles, CheckCircle2, XCircle, FileText, ArrowUpRight,
  Inbox
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/applications")({
  component: ApplicationsPage,
});

const COLUMNS = [
  { id: "Approved", label: "To Apply" },
  { id: "Applied", label: "Applied" },
  { id: "Interviewing", label: "Interviewing" },
  { id: "Offer", label: "Offer Received" },
];

function ApplicationsPage() {
  const queryClient = useQueryClient();
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [emailDraft, setEmailDraft] = useState<string | null>(null);
  const [targetEmail, setTargetEmail] = useState("");

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const res = await apiFetch("/api/leads?limit=200");
      if (!res.ok) throw new Error("Failed to fetch leads");
      return res.json();
    },
  });

  const apps = leads.filter((l: any) => 
    ["Approved", "Applied", "Interviewing", "Offer", "Rejected"].includes(l.status)
  );

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
    },
  });

  const phantmWriterMutation = useMutation({
    mutationFn: async (job: any) => {
      setSelectedJob(job);
      const res = await apiFetch(`/api/applications/phantm-writer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: job.job_id, company: job.company, role: job.title }),
      });
      if (!res.ok) throw new Error("Failed to generate email");
      return res.json();
    },
    onSuccess: (data) => {
      setEmailDraft(data.email);
      if (data.target_email) {
        setTargetEmail(data.target_email);
      }
    }
  });

  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      if (!selectedJob || !emailDraft || !targetEmail) return;
      const res = await apiFetch(`/api/applications/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: selectedJob.job_id,
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
      toast.success("Follow-up email sent successfully!");
    },
    onError: (err: any) => {
      toast.error(err.message);
    }
  });

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Applications</h1>
            <p className="text-sm text-zinc-400 mt-1">
              Track your active job applications across every stage of the hiring pipeline.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-zinc-950 px-4 py-2 rounded-xl text-center">
              <span className="text-xl font-bold text-white block font-mono">{apps.length}</span>
              <span className="text-[10px] uppercase font-semibold text-zinc-500">Total Tracked</span>
            </div>
            <div className="bg-zinc-950 px-4 py-2 rounded-xl text-center">
              <span className="text-xl font-bold text-white block font-mono">{apps.filter((a: any) => a.status === 'Offer').length}</span>
              <span className="text-[10px] uppercase font-semibold text-zinc-500">Offers</span>
            </div>
          </div>
        </div>

        {/* 4-Column Pipeline Tracker */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-zinc-500">
            <Loader2 className="w-8 h-8 animate-spin text-white mb-2" />
            <p className="text-sm">Loading applications...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
            {COLUMNS.map((col) => {
              const colApps = apps.filter((a: any) => a.status === col.id);
              
              return (
                <div key={col.id} className="bg-zinc-950 rounded-2xl p-4 min-h-[500px] flex flex-col">
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-3 mb-3">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-900 text-white">
                      {col.label}
                    </span>
                    <span className="text-xs font-mono font-medium text-zinc-500">{colApps.length}</span>
                  </div>
                  
                  {/* Cards List */}
                  <div className="space-y-3 flex-1">
                    {colApps.map((job: any) => (
                      <div key={job.job_id || job.id} className="bg-black hover:bg-zinc-900/60 rounded-xl p-3.5 transition-all">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="font-semibold text-sm text-white leading-snug line-clamp-2">{job.title}</h4>
                        </div>
                        <div className="text-xs font-medium text-zinc-300 mb-2">{job.company}</div>
                        
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400 mb-3">
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-zinc-500" /> {job.location || 'Remote'}</span>
                          {job.salary && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1 font-mono text-zinc-300">{job.salary}</span>
                            </>
                          )}
                        </div>

                        {/* Stage Specific Actions */}
                        <div className="pt-2.5 space-y-2">
                          {job.status === 'Applied' && (
                            <button 
                              onClick={() => phantmWriterMutation.mutate(job)}
                              disabled={phantmWriterMutation.isPending}
                              className="w-full h-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-medium transition flex items-center justify-center gap-1.5"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-white" />
                              Draft Follow-up
                            </button>
                          )}

                          {job.status === 'Interviewing' && (
                            <Link 
                              to="/company-research" 
                              search={{ company: job.company }}
                              className="w-full h-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-medium transition flex items-center justify-center gap-1.5"
                            >
                              <FileText className="w-3.5 h-3.5 text-white" /> Company Prep Guide
                            </Link>
                          )}

                          {/* Stage Transition Action */}
                          <div className="flex items-center gap-1.5 justify-between">
                            {job.status === 'Approved' && (
                              <button 
                                onClick={() => statusMutation.mutate({ id: job.job_id || job.id, status: 'Applied'})} 
                                className="flex-1 h-7 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-semibold transition inline-flex items-center justify-center gap-1"
                              >
                                Mark Applied <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                            {job.status === 'Applied' && (
                              <button 
                                onClick={() => statusMutation.mutate({ id: job.job_id || job.id, status: 'Interviewing'})} 
                                className="flex-1 h-7 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-medium transition inline-flex items-center justify-center gap-1"
                              >
                                Interview <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                            {job.status === 'Interviewing' && (
                              <>
                                <button 
                                  onClick={() => statusMutation.mutate({ id: job.job_id || job.id, status: 'Offer'})} 
                                  className="flex-1 h-7 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-semibold transition inline-flex items-center justify-center gap-1"
                                >
                                  <CheckCircle2 className="w-3 h-3" /> Got Offer
                                </button>
                                <button 
                                  onClick={() => statusMutation.mutate({ id: job.job_id || job.id, status: 'Rejected'})} 
                                  className="h-7 px-2 rounded-lg hover:bg-zinc-900 text-zinc-500 hover:text-white text-xs transition"
                                  title="Mark as rejected"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                            {job.status === 'Approved' && (
                              <a 
                                href={job.source_url || job.url || "#"} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="h-7 px-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium inline-flex items-center gap-1 transition"
                              >
                                Link <ArrowUpRight className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {colApps.length === 0 && (
                      <div className="py-12 text-center text-zinc-500 bg-zinc-900/30 rounded-xl">
                        <Inbox className="w-6 h-6 mx-auto mb-1.5 opacity-40 text-zinc-600" />
                        <span className="text-xs">No applications here</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Follow-up Note Modal */}
      {emailDraft && selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-zinc-950 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4">
              <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
                <Sparkles className="w-4 h-4 text-white" />
                Draft Follow-Up Email
              </h3>
              <button 
                onClick={() => { setEmailDraft(null); setSelectedJob(null); }}
                className="p-1 hover:bg-zinc-900 rounded-lg text-zinc-400 hover:text-white transition"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 space-y-3">
              <div>
                <span className="text-xs text-zinc-400 block mb-0.5">Role & Company</span>
                <span className="font-medium text-sm text-white">{selectedJob.title} @ {selectedJob.company}</span>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Target Recruiter Email</label>
                <input 
                  type="email"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  placeholder="recruiter@company.com"
                  className="w-full h-9 px-3 rounded-lg bg-black text-white text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Generated Note</label>
                <textarea 
                  className="w-full h-48 p-3 rounded-lg bg-black text-zinc-200 text-xs leading-relaxed focus:outline-none resize-none"
                  value={emailDraft}
                  onChange={(e) => setEmailDraft(e.target.value)}
                />
              </div>
            </div>

            <div className="p-4 bg-black/40 flex justify-end gap-2">
              <button 
                onClick={() => { setEmailDraft(null); setSelectedJob(null); setTargetEmail(""); }}
                className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-900 transition"
              >
                Cancel
              </button>
              <button 
                onClick={() => sendEmailMutation.mutate()}
                disabled={sendEmailMutation.isPending || !targetEmail}
                className="px-4 py-2 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
              >
                {sendEmailMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Send Email
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
