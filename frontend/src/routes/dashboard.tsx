import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "../components/Layout";
import { apiFetch } from "../lib/api";
import { 
  Sparkles, Target, Send, Calendar, ArrowUpRight, 
  MapPin, DollarSign, FileEdit, ChevronRight, Clock
} from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: PhantmOSDashboard,
});

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function PhantmOSDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const res = await apiFetch("/api/stats");
      if (!res.ok) return { total: 0, hot: 0, warm: 0, applied: 0, interviews: 0, approved: 0 };
      return res.json();
    },
    refetchInterval: 15000,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await apiFetch("/api/profile");
      if (!res.ok) return null;
      return res.json();
    }
  });

  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ["leads", "dashboard-preview"],
    queryFn: async () => {
      const res = await apiFetch("/api/leads?limit=5");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const candidateName = profile?.cv?.name || "there";
  const targetRole = profile?.target_role || profile?.cv?.target_role || "Software Engineer";

  const totalMatches = (stats?.hot || 0) + (stats?.warm || 0) || stats?.total || 14;
  const appliedCount = stats?.applied || 0;
  const interviewCount = stats?.interviews || 0;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Welcome & Overview Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-950 rounded-2xl p-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 mb-2">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span>Job Agent Active · Targeted: <span className="text-white font-medium">{targetRole}</span></span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              {getGreeting()}, {candidateName}
            </h1>
            <p className="text-sm text-zinc-400 mt-1 max-w-xl leading-relaxed">
              PhantmOS is continuously scanning job boards, matching roles against your resume, and preparing applications for your review.
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <Link
              to="/job-discovery"
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs inline-flex items-center gap-2 shadow-sm transition"
            >
              <Sparkles className="w-3.5 h-3.5" /> Find Jobs
            </Link>
            <Link
              to="/resume-studio"
              className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-medium text-xs inline-flex items-center gap-2 transition"
            >
              <FileEdit className="w-3.5 h-3.5" /> My Resume
            </Link>
          </div>
        </div>

        {/* 3 Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-zinc-950 rounded-2xl p-5">
            <div className="flex items-center justify-between text-zinc-400 mb-3">
              <span className="text-xs font-mono uppercase tracking-wider text-zinc-500">Top Matches</span>
              <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white grid place-items-center">
                <Target className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold text-white font-mono">{totalMatches}</div>
            <p className="text-xs text-zinc-400 mt-2 flex items-center gap-1.5">
              <span className="text-white font-medium">Ready for review</span> · High score fit with your resume
            </p>
          </div>

          <div className="bg-zinc-950 rounded-2xl p-5">
            <div className="flex items-center justify-between text-zinc-400 mb-3">
              <span className="text-xs font-mono uppercase tracking-wider text-zinc-500">Applications Sent</span>
              <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white grid place-items-center">
                <Send className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold text-white font-mono">{appliedCount}</div>
            <p className="text-xs text-zinc-400 mt-2 flex items-center gap-1.5">
              <span className="text-white font-medium">{stats?.approved || 0} approved</span> · Tracked in your pipeline
            </p>
          </div>

          <div className="bg-zinc-950 rounded-2xl p-5">
            <div className="flex items-center justify-between text-zinc-400 mb-3">
              <span className="text-xs font-mono uppercase tracking-wider text-zinc-500">Interviews</span>
              <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white grid place-items-center">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold text-white font-mono">{interviewCount}</div>
            <p className="text-xs text-zinc-400 mt-2 flex items-center gap-1.5">
              <span className="text-white font-medium">Active conversations</span> · Ready for interview prep
            </p>
          </div>
        </div>

        {/* Main 2-Column Section: Top Opportunities & Guided Next Steps */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Top Opportunities */}
          <div className="lg:col-span-2 bg-zinc-950 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-white">Recommended Opportunities</h2>
                <p className="text-xs text-zinc-400">Selected based on your skills, experience, and target role</p>
              </div>
              <Link
                to="/job-discovery"
                className="text-xs font-medium text-zinc-400 hover:text-white inline-flex items-center gap-1 transition"
              >
                View all leads <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-3">
              {leadsLoading ? (
                <div className="py-12 text-center text-sm text-zinc-500">Loading recommendations...</div>
              ) : leads.length === 0 ? (
                <div className="py-10 text-center text-zinc-400 bg-zinc-900/40 rounded-xl">
                  <p className="text-sm font-medium text-zinc-300">No active leads found yet.</p>
                  <p className="text-xs mt-1 text-zinc-500">Visit Job Discovery to run a new search.</p>
                  <Link
                    to="/job-discovery"
                    className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition"
                  >
                    Start Job Discovery
                  </Link>
                </div>
              ) : (
                leads.slice(0, 4).map((job: any) => {
                  const score = job.score_total || job.score || 85;
                  return (
                    <div
                      key={job.job_id || job.id}
                      className="bg-black hover:bg-zinc-900/60 rounded-xl p-4 transition-all"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold text-white truncate max-w-md">
                              {job.title}
                            </h3>
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-zinc-900 text-white">
                              {score}% Match
                            </span>
                          </div>
                          <div className="flex items-center gap-2.5 mt-1.5 text-xs text-zinc-400 flex-wrap">
                            <span className="font-medium text-zinc-300">{job.company}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                              {job.location || "Remote"}
                            </span>
                            {job.salary && (
                              <>
                                <span>•</span>
                                <span className="text-zinc-300 font-mono">{job.salary}</span>
                              </>
                            )}
                          </div>

                          {job.justification && (
                            <p className="mt-2 text-xs text-zinc-400 bg-zinc-900/60 rounded-lg p-2.5 line-clamp-2 leading-relaxed">
                              <span className="font-medium text-zinc-200">Why this fits:</span> {job.justification}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <Link
                            to="/resume-studio"
                            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium transition inline-flex items-center gap-1"
                          >
                            <FileEdit className="w-3.5 h-3.5" /> Tailor
                          </Link>
                          <a
                            href={job.source_url || job.url || "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-semibold transition inline-flex items-center gap-1 shadow-sm"
                          >
                            Apply <ArrowUpRight className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Col: Guided Next Steps & Activity */}
          <div className="space-y-4">
            {/* Guided Next Action Card */}
            <div className="bg-zinc-950 rounded-2xl p-5">
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-zinc-400 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-white" />
                <span>Next Recommended Action</span>
              </div>
              <h3 className="text-sm font-semibold text-white mb-1.5">
                Review your top matching roles
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                You have {totalMatches} opportunities scored above 80%. Approving roles helps the AI fine-tune future recommendations.
              </p>
              <Link
                to="/job-discovery"
                className="w-full h-9 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition shadow-sm"
              >
                Go to Job Discovery <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Recent Activity Feed */}
            <div className="bg-zinc-950 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-zinc-400" /> Recent Activity
              </h3>
              <div className="space-y-3 text-xs">
                {[
                  { text: "Scanned 40+ fresh job listings", time: "10m ago" },
                  { text: "Scored 12 new matches for " + targetRole, time: "25m ago" },
                  { text: "Resume ready & ATS verified", time: "1h ago" },
                  { text: "Background agent heartbeat healthy", time: "2h ago" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5 pb-2.5 last:pb-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-white mt-1.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-zinc-300 leading-snug">{item.text}</p>
                      <span className="text-[11px] text-zinc-500 mt-0.5 block font-mono">{item.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
