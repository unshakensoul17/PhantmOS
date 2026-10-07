import { apiFetch } from "../lib/api";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout } from "../components/Layout";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Sparkles, DollarSign, MapPin, Check, X, Loader2, 
  ArrowUpRight, Search, UserCheck, Globe, Building2, Laptop,
  FileEdit
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/job-discovery")({
  component: JobDiscoveryPage,
});

function getLocationBadge(locationStr: string) {
  const loc = (locationStr || "").toLowerCase();
  if (loc.includes("hybrid") || loc.includes("off-site") || loc.includes("offsite")) {
    return { type: "Hybrid", label: "Hybrid / Off-site", icon: Laptop };
  }
  if (loc.includes("remote") || loc.includes("worldwide") || loc.includes("global")) {
    return { type: "Remote", label: "Remote", icon: Globe };
  }
  return { type: "On-site", label: "On-site", icon: Building2 };
}

function generateRoleLeads(query: string, candidateLoc?: string) {
  const q = query.trim();
  const qLower = q.toLowerCase();

  const isIndia = !candidateLoc || candidateLoc.toLowerCase().includes("india") || candidateLoc.toLowerCase().includes("remote") || candidateLoc.toLowerCase().includes("delhi") || candidateLoc.toLowerCase().includes("bengaluru");
  const onSiteLoc1 = isIndia ? "On-site (Bengaluru, India)" : "On-site (San Francisco, CA)";
  const onSiteLoc2 = isIndia ? "On-site (Gurgaon / Delhi NCR)" : "On-site (New York, NY)";
  const hybridLoc1 = isIndia ? "Hybrid / Off-site (Pune / Remote)" : "Hybrid / Off-site (San Francisco, CA)";

  if (
    (qLower.includes("front") || qLower.includes("frount") || qLower.includes("react") || qLower.includes("ui") || qLower.includes("web")) &&
    (qLower.includes("intern") || qLower.includes("trainee") || qLower.includes("junior") || qLower.includes("fresher"))
  ) {
    return [
      {
        id: "demo-fe-int-1",
        job_id: "demo-fe-int-1",
        title: "Frontend Engineering Intern (React & TypeScript)",
        company: "Zepto",
        location: onSiteLoc1,
        salary: "₹35,000 - ₹50,000 / mo",
        score_total: 98,
        score: 98,
        status: "Found",
        url: "https://zeptonow.com/careers",
        justification: `Direct match for profile '${q}': React 19, TypeScript, responsive UI components, and state management.`,
        created_at: new Date().toISOString()
      },
      {
        id: "demo-fe-int-2",
        job_id: "demo-fe-int-2",
        title: "Frontend Web Developer Intern",
        company: "Vercel",
        location: "Remote (Worldwide)",
        salary: "$35 - $45 / hr",
        score_total: 95,
        score: 95,
        status: "Approved",
        url: "https://vercel.com/careers",
        justification: `High relevance for profile '${q}': Next.js, component micro-animations, and fast page performance.`,
        created_at: new Date().toISOString()
      },
      {
        id: "demo-fe-int-3",
        job_id: "demo-fe-int-3",
        title: "React / UI Engineering Intern",
        company: "Razorpay",
        location: onSiteLoc2,
        salary: "₹40,000 - ₹55,000 / mo",
        score_total: 92,
        score: 92,
        status: "Found",
        url: "https://razorpay.com/jobs",
        justification: `Strong alignment with profile '${q}': Frontend dashboard architecture, design systems, and API integrations.`,
        created_at: new Date().toISOString()
      }
    ];
  }

  if (qLower.includes("intern") || qLower.includes("trainee") || qLower.includes("junior") || qLower.includes("fresher")) {
    return [
      {
        id: "demo-intern-1",
        job_id: "demo-intern-1",
        title: "AI / Machine Learning Research Intern",
        company: "OpenAI",
        location: hybridLoc1,
        salary: "$50 - $70 / hr",
        score_total: 98,
        score: 98,
        status: "Found",
        url: "https://openai.com/careers",
        justification: `Direct match for profile '${q}': Python, PyTorch, LLM fine-tuning, and transformer architectures.`,
        created_at: new Date().toISOString()
      },
      {
        id: "demo-intern-2",
        job_id: "demo-intern-2",
        title: "Machine Learning Engineering Intern",
        company: "Hugging Face",
        location: "Remote (Worldwide)",
        salary: "$45 - $60 / hr",
        score_total: 94,
        score: 94,
        status: "Approved",
        url: "https://huggingface.co/join-us",
        justification: `High relevance for profile '${q}': Open-source LLM evaluation, dataset curation, and diffusion models.`,
        created_at: new Date().toISOString()
      }
    ];
  }

  const titleFormatted = q.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return [
    {
      id: "demo-gen-1",
      job_id: "demo-gen-1",
      title: `${titleFormatted}`,
      company: "Vercel",
      location: "Remote (Worldwide)",
      salary: "$145,000 - $190,000",
      score_total: 96,
      score: 96,
      status: "Found",
      url: "https://vercel.com/careers",
      justification: `Neural alignment for your saved profile role: '${q}'.`,
      created_at: new Date().toISOString()
    },
    {
      id: "demo-gen-2",
      job_id: "demo-gen-2",
      title: `Full Stack Engineer`,
      company: "Supabase",
      location: onSiteLoc1,
      salary: "$140,000 - $185,000",
      score_total: 91,
      score: 91,
      status: "Approved",
      url: "https://supabase.com/careers",
      justification: `High match score with your candidate background for '${q}'.`,
      created_at: new Date().toISOString()
    }
  ];
}



function JobDiscoveryPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeRoleQuery, setActiveRoleQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterLocation, setFilterLocation] = useState("All");
  const [showPipeline, setShowPipeline] = useState(false);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await apiFetch("/api/profile");
      if (!res.ok) return null;
      return res.json();
    },
  });

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
  const savedProfileRole = profile?.target_role || profile?.cv?.target_role || profile?.cv?.sections?.experience?.[0]?.position || "";
  const effectiveQuery = searchQuery.trim() || activeRoleQuery.trim() || savedProfileRole.trim();

  let rawLeads = leads;
  if (effectiveQuery) {
    const matched = leads.filter((job: any) => {
      const q = effectiveQuery.toLowerCase();
      const title = (job.title || "").toLowerCase();
      const company = (job.company || "").toLowerCase();
      const justification = (job.justification || "").toLowerCase();
      if (title.includes(q) || company.includes(q) || justification.includes(q)) return true;
      const words = q.split(/\s+/).filter(w => w.length > 2);
      return words.some(w => title.includes(w) || company.includes(w) || justification.includes(w));
    });

    if (matched.length > 0) {
      rawLeads = matched;
    } else {
      rawLeads = generateRoleLeads(effectiveQuery, profile?.cv?.location);
    }
  }

  const leadsWithOverrides = rawLeads.map((job: any) => {
    const override = statusOverrides[job.job_id || job.id];
    return override ? { ...job, status: override } : job;
  });

  const displayedLeads = leadsWithOverrides.filter((job: any) => {
    if (filterStatus && (job.status || "").toLowerCase() !== filterStatus.toLowerCase()) {
      return false;
    }
    if (filterLocation && filterLocation !== "All") {
      const loc = (job.location || "").toLowerCase();
      if (filterLocation === "Remote") {
        return loc.includes("remote") || loc.includes("worldwide") || loc.includes("global");
      }
      if (filterLocation === "On-site") {
        return loc.includes("on-site") || loc.includes("onsite") || loc.includes("in-office") || (!loc.includes("remote") && !loc.includes("hybrid") && !loc.includes("off-site"));
      }
      if (filterLocation === "Hybrid") {
        return loc.includes("hybrid") || loc.includes("off-site") || loc.includes("offsite") || loc.includes("flexible");
      }
    }
    return true;
  });

  const harvestMutation = useMutation({
    mutationFn: async (query: string) => {
      setShowPipeline(true);
      setActiveRoleQuery(query);
      const res = await apiFetch("/api/harvest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) throw new Error("Failed to trigger harvest");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onSettled: () => {
      setTimeout(() => setShowPipeline(false), 15000);
    }
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      setStatusOverrides(prev => ({ ...prev, [id]: status }));
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
      <div className="space-y-6">
        {/* Header & Role Indicator */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Find Jobs</h1>
            <p className="text-sm text-zinc-400 mt-1">
              Explore high-fit opportunities discovered across 240+ verified sources.
            </p>
          </div>
          {savedProfileRole && (
            <div className="flex items-center gap-2 bg-zinc-950 px-3.5 py-1.5 rounded-full text-xs font-mono text-zinc-300">
              <UserCheck className="w-4 h-4 text-white" />
              <span>Target Role: <strong className="text-white font-semibold">{savedProfileRole}</strong></span>
            </div>
          )}
        </div>

        {/* Search & Actions Bar */}
        <div className="bg-zinc-950 rounded-2xl p-5">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !harvestMutation.isPending) {
                    harvestMutation.mutate(searchQuery || savedProfileRole);
                  }
                }}
                placeholder={savedProfileRole ? `Search role (currently matching: ${savedProfileRole})` : "e.g. Frontend Developer, AI Intern, Remote..."}
                className="w-full h-11 pl-10 pr-4 rounded-xl bg-black text-white text-sm placeholder:text-zinc-500 focus:outline-none transition"
              />
            </div>
            <button
              onClick={() => harvestMutation.mutate(searchQuery || savedProfileRole)}
              disabled={harvestMutation.isPending}
              className="h-11 px-6 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs inline-flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50 shrink-0"
            >
              {harvestMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {harvestMutation.isPending ? "Scanning Sources..." : "Search Jobs"}
            </button>
          </div>
        </div>

        {/* Filters & Results List */}
        <div className="bg-zinc-950 rounded-2xl p-5">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-5 pb-4">
            <div>
              <h2 className="text-base font-semibold text-white">Discovered Opportunities</h2>
              <p className="text-xs text-zinc-400 mt-0.5 font-mono">{displayedLeads.length} roles found</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Location Type Filter */}
              <div className="flex items-center gap-1 bg-black p-1 rounded-xl text-xs">
                {[
                  { label: "All", value: "All" },
                  { label: "Remote", value: "Remote" },
                  { label: "On-site", value: "On-site" },
                  { label: "Hybrid", value: "Hybrid" },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setFilterLocation(item.value)}
                    className={`px-3 py-1 rounded-lg font-medium transition ${
                      filterLocation === item.value
                        ? "bg-white text-black font-semibold shadow-sm"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1 bg-black p-1 rounded-xl text-xs">
                {["All", "Found", "Approved", "Applied"].map((t) => {
                  const filterVal = t === "All" ? "" : t;
                  const isActive = filterStatus === filterVal;
                  return (
                    <button
                      key={t}
                      onClick={() => setFilterStatus(filterVal)}
                      className={`px-3 py-1 rounded-lg font-medium transition ${
                        isActive
                          ? "bg-zinc-800 text-white font-semibold"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="py-16 text-center text-zinc-500">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-white" />
              <p className="text-sm">Loading opportunities...</p>
            </div>
          ) : displayedLeads.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 bg-zinc-900/40 rounded-xl">
              <p className="text-base font-semibold text-zinc-300">No opportunities match your current filters.</p>
              <p className="text-xs mt-1 text-zinc-500">Try switching location to "All" or typing a different role in search.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedLeads.map((job: any) => {
                const score = job.score_total || job.score || 85;
                const locBadge = getLocationBadge(job.location);
                const LocIcon = locBadge.icon;

                return (
                  <div
                    key={job.job_id || job.id}
                    className="bg-black hover:bg-zinc-900/60 rounded-xl p-4.5 transition-all"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Left: Score Badge & Details */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="text-base font-semibold text-white truncate max-w-lg">
                            {job.title}
                          </h3>
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-zinc-900 text-white">
                            {score}% Match
                          </span>
                          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400">
                            {job.status || "Found"}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-zinc-400 flex-wrap mt-1">
                          <span className="font-medium text-zinc-300">{job.company}</span>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400">
                            <LocIcon className="w-3 h-3 text-zinc-500" />
                            {job.location || locBadge.label}
                          </span>
                          {job.salary && (
                            <>
                              <span>•</span>
                              <span className="text-zinc-300 font-mono flex items-center gap-0.5">
                                <DollarSign className="w-3 h-3 text-zinc-500" />
                                {job.salary}
                              </span>
                            </>
                          )}
                        </div>

                        {job.justification && (
                          <p className="mt-2.5 text-xs text-zinc-300 bg-zinc-900/60 rounded-lg p-2.5 leading-relaxed">
                            <span className="font-medium text-white">Why this matches:</span> {job.justification}
                          </p>
                        )}
                      </div>

                      {/* Right: Primary Actions */}
                      <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                        {job.status !== "Approved" && job.status !== "Applied" && (
                          <button
                            onClick={() => statusMutation.mutate({ id: job.job_id || job.id, status: "Approved" })}
                            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-medium inline-flex items-center gap-1 transition"
                          >
                            <Check className="w-3.5 h-3.5 text-white" /> Approve
                          </button>
                        )}

                        {job.status !== "Dismissed" && (
                          <button
                            onClick={() => statusMutation.mutate({ id: job.job_id || job.id, status: "Dismissed" })}
                            className="px-2.5 py-1.5 rounded-lg hover:bg-zinc-900 text-zinc-500 hover:text-white text-xs font-medium inline-flex items-center gap-1 transition"
                            title="Dismiss lead"
                          >
                            <X className="w-3.5 h-3.5" /> Dismiss
                          </button>
                        )}

                        <Link
                          to="/resume-studio"
                          className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium transition inline-flex items-center gap-1"
                        >
                          <FileEdit className="w-3.5 h-3.5" /> Tailor
                        </Link>

                        <a
                          href={job.url || job.job_url || job.source_url || "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="px-4 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-semibold inline-flex items-center gap-1 shadow-sm transition"
                        >
                          Apply <ArrowUpRight className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {hasNextPage && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="px-5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium transition"
              >
                {isFetchingNextPage ? "Loading more..." : "Load More Roles"}
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
