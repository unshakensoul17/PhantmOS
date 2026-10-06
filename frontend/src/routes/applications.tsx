import { apiFetch } from "../lib/api";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout } from "../components/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Building2, MapPin, DollarSign, Loader2, ArrowRight, Clock, 
  Send, Sparkles, CheckCircle2, XCircle, FileText, ChevronRight, ArrowUpRight
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/applications")({
  component: ApplicationsPage,
});

const COLUMNS = [
  { id: "Approved", label: "To Apply", color: "text-neon-blue", border: "border-neon-blue/30" },
  { id: "Applied", label: "Applied", color: "text-neon-cyan", border: "border-neon-cyan/30" },
  { id: "Interviewing", label: "Interviewing", color: "text-neon-purple", border: "border-neon-purple/30" },
  { id: "Offer", label: "Offer Received", color: "text-neon-green", border: "border-neon-green/30" },
  { id: "Rejected", label: "Rejected", color: "text-neon-pink", border: "border-neon-pink/30" },
];

function ApplicationsPage() {
  const queryClient = useQueryClient();
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [emailDraft, setEmailDraft] = useState<string | null>(null);
  const [targetEmail, setTargetEmail] = useState("");

  // Fetch all leads that have an application-related status
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const res = await apiFetch("/api/leads?limit=200");
      if (!res.ok) throw new Error("Failed to fetch leads");
      return res.json();
    },
  });

  // Filter only application-related statuses
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
      alert("Email sent successfully!");
    },
    onError: (err: any) => {
      alert(err.message);
    }
  });

  return (
    <Layout>
      <div className="space-y-6 animate-fade-up">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
          <div>
            <div className="text-[13px] font-mono text-neon-blue mb-1">Pipeline Tracking</div>
            <h2 className="text-3xl font-bold tracking-tight">Active Applications</h2>
          </div>
          <div className="flex gap-4">
            <div className="text-right">
              <div className="text-2xl font-bold font-mono text-neon-cyan">{apps.length}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Active</div>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="text-right">
              <div className="text-2xl font-bold font-mono text-neon-green">{apps.filter((a: any) => a.status === 'Offer').length}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Offers</div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-neon-blue mb-3" />
            <p className="font-mono text-sm">Loading application pipeline...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-start">
            {COLUMNS.map((col) => {
              const colApps = apps.filter((a: any) => a.status === col.id);
              
              return (
                <div key={col.id} className="glass-strong rounded-2xl border border-white/5 p-4 min-h-[60vh] flex flex-col">
                  <div className={`flex items-center justify-between mb-4 pb-3 border-b ${col.border}`}>
                    <h3 className={`font-bold font-mono uppercase tracking-wide text-sm ${col.color}`}>{col.label}</h3>
                    <span className="text-xs px-2 py-0.5 rounded bg-white/10 font-mono">{colApps.length}</span>
                  </div>
                  
                  <div className="space-y-3 flex-1">
                    {colApps.map((job: any) => (
                      <div key={job.job_id} className="glass rounded-xl p-4 hover:scale-[1.02] hover:bg-[#1A1A1A] transition-all duration-200 group">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-sm leading-snug line-clamp-2 pr-4">{job.title}</h4>
                          <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                        </div>
                        <div className="text-xs text-muted-foreground mb-3">{job.company}</div>
                        
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground mb-4">
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {job.location || 'Remote'}</span>
                          <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> {job.salary || 'N/A'}</span>
                        </div>

                        {/* Stage Specific Actions */}
                        <div className="pt-3 border-t border-white/5 space-y-2">
                          
                          {/* Tailored Resume Link */}
                          {job.resume_url && (
                            <a 
                              href={job.resume_url}
                              target="_blank" rel="noreferrer"
                              className="w-full h-8 rounded-lg bg-white/5 border border-white/10 text-white text-xs font-semibold hover:bg-white/10 transition flex items-center justify-center gap-1.5"
                            >
                              <FileText className="w-3 h-3" /> View Tailored Resume
                            </a>
                          )}

                          {/* App Stage -> Phantm Writer */}
                          {job.status === 'Applied' && (
                            <button 
                              onClick={() => phantmWriterMutation.mutate(job)}
                              disabled={phantmWriterMutation.isPending}
                              className="w-full h-8 rounded-lg bg-gradient-to-r from-neon-blue/20 to-neon-purple/20 border border-neon-blue/30 text-neon-blue text-xs font-semibold hover:bg-neon-blue/30 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                            >
                              {phantmWriterMutation.isPending && selectedJob?.job_id === job.job_id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Sparkles className="w-3 h-3" />
                              )}
                              Draft Follow-up (Phantm Writer)
                            </button>
                          )}

                          {/* Interview Stage -> Playbook */}
                          {job.status === 'Interviewing' && (
                            <Link 
                              to="/company-research" 
                              search={{ company: job.company }}
                              className="w-full h-8 rounded-lg bg-neon-cyan/20 border border-neon-cyan/30 text-neon-cyan text-xs font-semibold hover:bg-neon-cyan/30 transition flex items-center justify-center gap-1.5"
                            >
                              <FileText className="w-3 h-3" /> Open Playbook
                            </Link>
                          )}

                          {/* State Transition Actions */}
                          <div className="flex items-center gap-1.5 justify-between">
                            {job.status === 'Approved' && (
                              <button onClick={() => statusMutation.mutate({ id: job.job_id, status: 'Applied'})} className="flex-1 h-7 rounded bg-neon-cyan/10 hover:bg-neon-cyan/20 text-neon-cyan text-[10px] uppercase font-mono tracking-wider transition inline-flex items-center justify-center gap-1">
                                Mark Applied <CheckCircle2 className="w-3 h-3" />
                              </button>
                            )}
                            {job.status === 'Applied' && (
                              <button onClick={() => statusMutation.mutate({ id: job.job_id, status: 'Interviewing'})} className="flex-1 h-7 rounded bg-white/5 hover:bg-white/10 text-[10px] uppercase font-mono tracking-wider transition inline-flex items-center justify-center gap-1">
                                Interview <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                            {job.status === 'Interviewing' && (
                              <>
                                <button onClick={() => statusMutation.mutate({ id: job.job_id, status: 'Offer'})} className="flex-1 h-7 rounded bg-neon-green/10 hover:bg-neon-green/20 text-neon-green text-[10px] uppercase font-mono tracking-wider transition inline-flex items-center justify-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Offer
                                </button>
                                <button onClick={() => statusMutation.mutate({ id: job.job_id, status: 'Rejected'})} className="flex-1 h-7 rounded bg-neon-pink/10 hover:bg-neon-pink/20 text-neon-pink text-[10px] uppercase font-mono tracking-wider transition inline-flex items-center justify-center gap-1">
                                  <XCircle className="w-3 h-3" /> Reject
                                </button>
                              </>
                            )}
                            {job.status === 'Applied' && (
                              <button onClick={() => statusMutation.mutate({ id: job.job_id, status: 'Rejected'})} className="w-7 h-7 shrink-0 rounded bg-neon-pink/10 hover:bg-neon-pink/20 text-neon-pink flex items-center justify-center transition">
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {job.status === 'Approved' && (
                              <a href={job.source_url} target="_blank" rel="noreferrer" className="w-7 h-7 shrink-0 rounded bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition">
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {colApps.length === 0 && (
                      <div className="py-10 text-center border-2 border-dashed border-white/5 rounded-xl text-muted-foreground">
                        <Clock className="w-6 h-6 mx-auto mb-2 opacity-30" />
                        <span className="text-xs font-mono">Empty Pipeline</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Phantm Writer Modal */}
      {emailDraft && selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0B1020] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl glass-strong">
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <h3 className="font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-neon-blue" />
                AI Phantm Writer
              </h3>
              <button 
                onClick={() => { setEmailDraft(null); setSelectedJob(null); }}
                className="p-1 hover:bg-white/10 rounded-lg transition"
              >
                <XCircle className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <div className="text-xs font-mono text-muted-foreground mb-1 uppercase tracking-wider">Drafted Follow-up For</div>
                <div className="font-semibold text-lg">{selectedJob.company}</div>
                <div className="text-sm text-neon-cyan">{selectedJob.title}</div>
              </div>

              <div className="mb-4">
                <div className="text-xs font-mono text-muted-foreground mb-1 uppercase tracking-wider">Recruiter / Target Email</div>
                <input 
                  type="email"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  placeholder="recruiter@company.com"
                  className="w-full h-10 px-3 rounded-xl bg-black/40 border border-white/10 text-sm focus:outline-none focus:border-neon-blue/50 transition font-sans"
                />
              </div>

              <div className="relative">
                <div className="absolute top-3 right-3 flex gap-2">
                  <button className="text-[11px] font-mono px-2 py-1 bg-white/10 hover:bg-white/20 rounded transition">Copy to Clipboard</button>
                </div>
                <textarea 
                  className="w-full h-64 p-4 rounded-xl bg-black/40 border border-white/10 text-sm leading-relaxed focus:outline-none focus:border-neon-blue/50 transition font-sans resize-none"
                  value={emailDraft}
                  onChange={(e) => setEmailDraft(e.target.value)}
                />
              </div>
            </div>

            <div className="p-4 border-t border-white/5 bg-white/5 flex justify-end gap-3">
              <button 
                onClick={() => { setEmailDraft(null); setSelectedJob(null); setTargetEmail(""); }}
                className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/10 transition"
              >
                Cancel
              </button>
              <button 
                onClick={() => sendEmailMutation.mutate()}
                disabled={sendEmailMutation.isPending || !targetEmail}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-neon-blue to-neon-purple text-black text-sm font-semibold flex items-center gap-2 hover:scale-[1.02] transition shadow-lg shadow-neon-blue/20 disabled:opacity-50 disabled:hover:scale-100"
              >
                {sendEmailMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sendEmailMutation.isPending ? "Sending..." : "Send Email via Gmail Integration"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
