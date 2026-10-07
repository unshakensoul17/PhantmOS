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
    staleTime: 30000,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await apiFetch("/api/profile");
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 30000,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["leads", "dashboard-preview"],
    queryFn: async () => {
      const res = await apiFetch("/api/leads?limit=5");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30000,
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
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Welcome back, {candidateName}
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Here is what is happening with your job search.
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

        {/* 4 Simple Metrics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-zinc-950 rounded-2xl p-5">
            <span className="text-xs text-zinc-400">Jobs Found</span>
            <div className="text-3xl font-bold text-white font-mono mt-1">{totalMatches}</div>
            <p className="text-xs text-zinc-500 mt-1">Jobs that match you</p>
          </div>

          <div className="bg-zinc-950 rounded-2xl p-5">
            <span className="text-xs text-zinc-400">Resume Ready</span>
            <div className="text-3xl font-bold text-white font-mono mt-1">{stats?.approved || 1}</div>
            <p className="text-xs text-zinc-500 mt-1">Resumes ready to use</p>
          </div>

          <div className="bg-zinc-950 rounded-2xl p-5">
            <span className="text-xs text-zinc-400">Applied</span>
            <div className="text-3xl font-bold text-white font-mono mt-1">{appliedCount}</div>
            <p className="text-xs text-zinc-500 mt-1">Jobs you applied to</p>
          </div>

          <div className="bg-zinc-950 rounded-2xl p-5">
            <span className="text-xs text-zinc-400">Interviews</span>
            <div className="text-3xl font-bold text-white font-mono mt-1">{interviewCount}</div>
            <p className="text-xs text-zinc-500 mt-1">Active interviews</p>
          </div>
        </div>

        {/* Main 2-Column Section: Recommended Jobs & Next Step */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Jobs For You */}
          <div className="lg:col-span-2 bg-zinc-950 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-white">Jobs For You</h2>
                <p className="text-xs text-zinc-400">These jobs look like a good match for you.</p>
              </div>
              <Link
                to="/job-discovery"
                className="text-xs font-medium text-zinc-400 hover:text-white inline-flex items-center gap-1 transition"
              >
                See All Jobs <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-3">
              {leads.length === 0 ? (
                <div className="py-10 text-center text-zinc-400 bg-zinc-900/40 rounded-xl">
                  <p className="text-sm font-medium text-zinc-300">No matching jobs found.</p>
                  <p className="text-xs mt-1 text-zinc-500">Tell us what job you want and we will find matching jobs.</p>
                  <Link
                    to="/job-discovery"
                    className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition"
                  >
                    Find Jobs
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
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-zinc-900 text-white font-medium">
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
                            <span>•</span>
                            <span>Full-time</span>
                            {job.salary && (
                              <>
                                <span>•</span>
                                <span className="text-zinc-300 font-mono">{job.salary}</span>
                              </>
                            )}
                          </div>

                          <p className="mt-2 text-xs text-zinc-400 bg-zinc-900/60 rounded-lg p-2.5 leading-relaxed">
                            <span className="font-medium text-zinc-200">Why this job?</span> {job.justification || "Your skills and experience match this job."}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <Link
                            to="/resume-studio"
                            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium transition inline-flex items-center gap-1"
                          >
                            <FileEdit className="w-3.5 h-3.5" /> Improve Resume
                          </Link>
                          <a
                            href={job.source_url || job.url || "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-semibold transition inline-flex items-center gap-1 shadow-sm"
                          >
                            View Job <ArrowUpRight className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                }))}
            </div>
          </div>

          {/* Right Col: What To Do Next */}
          <div className="space-y-4">
            <div className="bg-zinc-950 rounded-2xl p-5">
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-400 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-white" />
                <span>What should I do next?</span>
              </div>
              <h3 className="text-sm font-semibold text-white mb-1.5">
                You have {totalMatches} good jobs to review.
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                Review these jobs and choose which ones you want to apply for.
              </p>
              <Link
                to="/job-discovery"
                className="w-full h-9 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition shadow-sm"
              >
                See Jobs <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
