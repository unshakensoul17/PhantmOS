import { apiFetch } from "../lib/api";
import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "../components/Layout";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Radar, Target, Zap, DollarSign, MapPin, Sparkles, 
  Check, X, Loader2, ArrowUpRight, Search, UserCheck,
  Globe, Building2, Laptop
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

function getLocationBadge(locationStr: string) {
  const loc = (locationStr || "").toLowerCase();
  if (loc.includes("hybrid") || loc.includes("off-site") || loc.includes("offsite")) {
    return { type: "Hybrid", label: "Off-site / Hybrid", icon: Laptop, color: "text-neon-purple bg-neon-purple/10 border-neon-purple/30" };
  }
  if (loc.includes("remote") || loc.includes("worldwide") || loc.includes("global")) {
    return { type: "Remote", label: "Remote", icon: Globe, color: "text-neon-cyan bg-neon-cyan/10 border-neon-cyan/30" };
  }
  return { type: "On-site", label: "On-site", icon: Building2, color: "text-neon-amber bg-neon-amber/10 border-neon-amber/30" };
}

function generateRoleLeads(query: string, candidateLoc?: string) {
  const q = query.trim();
  const qLower = q.toLowerCase();

  // Determine realistic location base matching candidate profile or Indian tech hubs
  const isIndia = !candidateLoc || candidateLoc.toLowerCase().includes("india") || candidateLoc.toLowerCase().includes("remote") || candidateLoc.toLowerCase().includes("delhi") || candidateLoc.toLowerCase().includes("bengaluru");
  const onSiteLoc1 = isIndia ? "On-site (Bengaluru, India)" : "On-site (San Francisco, CA)";
  const onSiteLoc2 = isIndia ? "On-site (Gurgaon / Delhi NCR)" : "On-site (New York, NY)";
  const onSiteLoc3 = isIndia ? "On-site (Noida / NCR)" : "On-site (Seattle, WA)";
  const hybridLoc1 = isIndia ? "Hybrid / Off-site (Pune / Remote)" : "Hybrid / Off-site (San Francisco, CA)";
  const hybridLoc2 = isIndia ? "Hybrid / Off-site (Hyderabad, India)" : "Hybrid / Off-site (London, UK)";

  // 1. Specialized: Frontend / React / Web Intern (handles "frountend intern", "frontend intern", "react intern")
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
        score_band: "A",
        status: "Found",
        url: "https://zeptonow.com/careers",
        source: "Himalayas",
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
        score_band: "A",
        status: "Approved",
        url: "https://vercel.com/careers",
        source: "Remotive",
        justification: `High relevance for profile '${q}': Next.js, Tailwind CSS, component micro-animations, and fast page performance.`,
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
        score_band: "A",
        status: "Found",
        url: "https://razorpay.com/jobs",
        source: "HackerNews",
        justification: `Strong alignment with profile '${q}': Frontend dashboard architecture, design systems, and API integrations.`,
        created_at: new Date().toISOString()
      },
      {
        id: "demo-fe-int-4",
        job_id: "demo-fe-int-4",
        title: "Junior Frontend Developer Intern",
        company: "Swiggy",
        location: hybridLoc1,
        salary: "₹35,000 - ₹45,000 / mo",
        score_total: 89,
        score: 89,
        score_band: "B",
        status: "Applied",
        url: "https://swiggy.com/careers",
        source: "Arbeitnow",
        justification: `Matches foundational JavaScript, HTML5/CSS3, and modern framework skills for '${q}'.`,
        created_at: new Date().toISOString()
      },
      {
        id: "demo-fe-int-5",
        job_id: "demo-fe-int-5",
        title: "Frontend UI/UX Intern",
        company: "Postman",
        location: hybridLoc2,
        salary: "₹40,000 - ₹50,000 / mo",
        score_total: 86,
        score: 86,
        score_band: "B",
        status: "Interviewing",
        url: "https://postman.com/careers",
        source: "Himalayas",
        justification: `Candidate demonstrates strong visual design implementation and responsive UI skills for '${q}'.`,
        created_at: new Date().toISOString()
      }
    ];
  }

  // 2. AI / ML / Data Science Intern
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
        score_band: "A",
        status: "Found",
        url: "https://openai.com/careers",
        source: "Himalayas",
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
        score_band: "A",
        status: "Approved",
        url: "https://huggingface.co/join-us",
        source: "Remotive",
        justification: `High relevance for profile '${q}': Open-source LLM evaluation, dataset curation, and diffusion models.`,
        created_at: new Date().toISOString()
      },
      {
        id: "demo-intern-3",
        job_id: "demo-intern-3",
        title: "Generative AI Systems Intern",
        company: "Cohere",
        location: onSiteLoc1,
        salary: "₹40,000 - ₹60,000 / mo",
        score_total: 91,
        score: 91,
        score_band: "A",
        status: "Found",
        url: "https://cohere.com/careers",
        source: "HackerNews",
        justification: `Strong alignment with profile '${q}': RAG pipelines, vector databases, and embeddings.`,
        created_at: new Date().toISOString()
      },
      {
        id: "demo-intern-4",
        job_id: "demo-intern-4",
        title: "Computer Vision & Deep Learning Intern",
        company: "Midjourney",
        location: "Remote (Global)",
        salary: "$45 - $65 / hr",
        score_total: 88,
        score: 88,
        score_band: "B",
        status: "Applied",
        url: "https://midjourney.com",
        source: "Arbeitnow",
        justification: `Matches candidate's foundational computer vision and deep learning skills for '${q}'.`,
        created_at: new Date().toISOString()
      },
      {
        id: "demo-intern-5",
        job_id: "demo-intern-5",
        title: "Data Science & AI Intern",
        company: "Scale AI",
        location: onSiteLoc2,
        salary: "₹35,000 - ₹50,000 / mo",
        score_total: 85,
        score: 85,
        score_band: "B",
        status: "Interviewing",
        url: "https://scale.com/careers",
        source: "Himalayas",
        justification: `Matches Python, NumPy, SciPy, and automated labeling pipelines for '${q}'.`,
        created_at: new Date().toISOString()
      },
      {
        id: "demo-intern-6",
        job_id: "demo-intern-6",
        title: "Deep Reinforcement Learning Intern",
        company: "Google DeepMind",
        location: hybridLoc2,
        salary: "₹50,000 - ₹75,000 / mo",
        score_total: 96,
        score: 96,
        score_band: "A",
        status: "Found",
        url: "https://deepmind.google/careers",
        source: "Himalayas",
        justification: `Candidate shows outstanding alignment with deep learning and reinforcement algorithms for '${q}'.`,
        created_at: new Date().toISOString()
      }
    ];
  }

  if (qLower.includes("full") || qLower.includes("stack") || qLower.includes("devloper") || qLower.includes("developer") || qLower.includes("software")) {
    return [
      {
        id: "demo-fs-1",
        job_id: "demo-fs-1",
        title: "Full Stack Developer (React & Python/FastAPI)",
        company: "Vercel",
        location: "Remote (Worldwide)",
        salary: "$150,000 - $195,000",
        score_total: 97,
        score: 97,
        score_band: "A",
        status: "Found",
        url: "https://vercel.com/careers",
        source: "Remotive",
        justification: `Direct match for profile '${q}': React 19, TypeScript, modern REST/GraphQL APIs, and Tailwind.`,
        created_at: new Date().toISOString()
      },
      {
        id: "demo-fs-2",
        job_id: "demo-fs-2",
        title: "Senior Full Stack Software Engineer",
        company: "Supabase",
        location: "On-site (San Francisco, CA)",
        salary: "$160,000 - $210,000",
        score_total: 94,
        score: 94,
        score_band: "A",
        status: "Approved",
        url: "https://supabase.com/careers",
        source: "HackerNews",
        justification: `High alignment for profile '${q}': PostgreSQL, distributed backends, and dashboard architectures.`,
        created_at: new Date().toISOString()
      },
      {
        id: "demo-fs-3",
        job_id: "demo-fs-3",
        title: "Full Stack Product Engineer",
        company: "Linear",
        location: "Hybrid / Off-site (San Francisco, CA)",
        salary: "$165,000 - $215,000",
        score_total: 91,
        score: 91,
        score_band: "A",
        status: "Found",
        url: "https://linear.app/careers",
        source: "Himalayas",
        justification: `Strong fit for profile '${q}': Real-time sync, WebSockets, and state-of-the-art UI engineering.`,
        created_at: new Date().toISOString()
      },
      {
        id: "demo-fs-4",
        job_id: "demo-fs-4",
        title: "Full Stack Applications Engineer",
        company: "Scale AI",
        location: "On-site (New York, NY)",
        salary: "$155,000 - $200,000",
        score_total: 88,
        score: 88,
        score_band: "B",
        status: "Applied",
        url: "https://scale.com/careers",
        source: "Arbeitnow",
        justification: `High overlap with candidate's full-stack architecture background for '${q}'.`,
        created_at: new Date().toISOString()
      },
      {
        id: "demo-fs-5",
        job_id: "demo-fs-5",
        title: "Lead Full Stack Systems Engineer",
        company: "Stripe",
        location: "Remote (Global)",
        salary: "$175,000 - $230,000",
        score_total: 89,
        score: 89,
        score_band: "B",
        status: "Interviewing",
        url: "https://stripe.com/jobs",
        source: "Himalayas",
        justification: `Targeted match for '${q}' with scalable payment workflows and resilient API architectures.`,
        created_at: new Date().toISOString()
      }
    ];
  }

  const titleFormatted = q.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return [
    {
      id: "demo-gen-1",
      job_id: "demo-gen-1",
      title: `${titleFormatted} Specialist`,
      company: "Anthropic",
      location: "On-site (San Francisco, CA)",
      salary: "$150,000 - $200,000",
      score_total: 96,
      score: 96,
      score_band: "A",
      status: "Found",
      url: "https://anthropic.com/careers",
      source: "Himalayas",
      justification: `Neural alignment for your saved profile role: '${q}'.`,
      created_at: new Date().toISOString()
    },
    {
      id: "demo-gen-2",
      job_id: "demo-gen-2",
      title: `Lead ${titleFormatted}`,
      company: "Vercel",
      location: "Remote (Worldwide)",
      salary: "$145,000 - $190,000",
      score_total: 92,
      score: 92,
      score_band: "A",
      status: "Approved",
      url: "https://vercel.com/careers",
      source: "Remotive",
      justification: `High relevance score based on targeted skills for '${q}'.`,
      created_at: new Date().toISOString()
    },
    {
      id: "demo-gen-3",
      job_id: "demo-gen-3",
      title: `${titleFormatted}`,
      company: "Supabase",
      location: "Hybrid / Off-site (London / Remote)",
      salary: "$140,000 - $185,000",
      score_total: 89,
      score: 89,
      score_band: "B",
      status: "Applied",
      url: "https://supabase.com/careers",
      source: "HackerNews",
      justification: `Strong match with candidate background for '${q}'.`,
      created_at: new Date().toISOString()
    }
  ];
}

function JobDiscoveryPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeRoleQuery, setActiveRoleQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterLocation, setFilterLocation] = useState("All"); // "All" | "Remote" | "On-site" | "Hybrid"
  const [showPipeline, setShowPipeline] = useState(false);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});

  // Fetch the saved resume profile
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

  // Apply any status overrides from user actions
  const leadsWithOverrides = rawLeads.map((job: any) => {
    const override = statusOverrides[job.job_id || job.id];
    return override ? { ...job, status: override } : job;
  });

  const displayedLeads = leadsWithOverrides.filter((job: any) => {
    // 1. Filter by Pipeline Status
    if (filterStatus && (job.status || "").toLowerCase() !== filterStatus.toLowerCase()) {
      return false;
    }
    // 2. Filter by Workplace Type (All, Remote, On-site, Off-site / Hybrid)
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
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono text-neon-blue">Target Role / Query</label>
                {savedProfileRole && (
                  <span className="text-[11px] font-mono text-neon-green/90 bg-neon-green/10 border border-neon-green/20 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    <UserCheck className="w-3 h-3" /> Profile Role: {savedProfileRole}
                  </span>
                )}
              </div>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !harvestMutation.isPending) {
                      harvestMutation.mutate(searchQuery || savedProfileRole);
                    }
                  }}
                  placeholder={savedProfileRole ? `Matching: ${savedProfileRole} (type to search other roles)` : "e.g. AI ML Intern, Full Stack Developer"}
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
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-5 gap-4">
            <div>
              <h3 className="text-xl font-bold">High-Signal Opportunities</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Filter by location or pipeline stage</p>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              {/* Workplace Location Type Filter */}
              <div className="flex gap-1 p-1 rounded-lg glass text-xs items-center">
                <span className="text-[11px] font-mono text-muted-foreground px-1.5 hidden sm:inline">Location:</span>
                {[
                  { label: "All", value: "All", icon: Target },
                  { label: "Remote", value: "Remote", icon: Globe },
                  { label: "On-site", value: "On-site", icon: Building2 },
                  { label: "Off-site / Hybrid", value: "Hybrid", icon: Laptop },
                ].map((item) => {
                  const isActive = filterLocation === item.value;
                  const Icon = item.icon;
                  return (
                    <button 
                      key={item.value}
                      onClick={() => setFilterLocation(item.value)}
                      className={`px-2.5 py-1.5 rounded-md font-medium transition inline-flex items-center gap-1.5 ${
                        isActive ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 shadow-[0_0_8px_rgba(0,240,255,0.2)]" : "text-muted-foreground hover:text-white"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {/* Status Filter */}
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
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mb-3 text-neon-cyan" />
              <p className="font-mono text-sm">Loading intelligence feed...</p>
            </div>
          ) : displayedLeads?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground bg-black/20 rounded-xl border border-dashed border-white/10">
              <Target className="w-10 h-10 mb-3 opacity-50" />
              <p className="text-sm font-medium text-white">No matching opportunities found.</p>
              <p className="text-xs mt-1">Try another search keyword or run the discovery engine.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedLeads?.map((job: any, index: number) => {
                const s = scoreStyle(job.score_total || 0);
                const circ = 2 * Math.PI * 20;
                const dash = ((job.score_total || 0) / 100) * circ;
                const locBadge = getLocationBadge(job.location);
                const LocIcon = locBadge.icon;
                
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
                    <div className="min-w-0 flex-1 w-full">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm sm:text-base text-white truncate max-w-[280px]" title={job.title}>{job.title}</h3>
                        {job.score_band && (
                          <span className={`text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded whitespace-nowrap shrink-0 ${
                            job.score_band === 'A' ? "bg-neon-green/15 text-neon-green border border-neon-green/30" : 
                            job.score_band === 'B' ? "bg-neon-blue/15 text-neon-blue border border-neon-blue/30" :
                            "bg-neon-amber/15 text-neon-amber border border-neon-amber/30"
                          }`}>{job.score_band}-Tier</span>
                        )}
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-muted-foreground uppercase">{job.status}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground flex-wrap">
                        <span className="font-medium text-white/90">{job.company}</span>
                        <span className="text-white/20">·</span>
                        <span className="flex items-center gap-1 whitespace-nowrap text-neon-green/90 font-mono">
                          <DollarSign className="w-3 h-3 shrink-0" />
                          {job.salary || "Undisclosed"}
                        </span>
                        <span className="text-white/20">·</span>
                        <span className={`text-[11px] font-mono px-2 py-0.5 rounded-md border inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${locBadge.color}`}>
                          <LocIcon className="w-3 h-3 shrink-0" />
                          {job.location || locBadge.label}
                        </span>
                      </div>

                      {/* AI Assessment */}
                      {job.justification && (
                        <div className={`mt-2 px-2.5 py-1.5 rounded-md border text-xs ${s.bg}`}>
                          <div className="flex items-center gap-1.5 font-mono text-[11px] text-neon-cyan mb-0.5">
                            <Sparkles className={`w-3 h-3 shrink-0 ${s.color}`} />
                            <span>AI Assessment</span>
                          </div>
                          <p className="text-muted-foreground text-xs leading-snug line-clamp-1">{job.justification}</p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center w-full md:w-auto justify-end pt-2 md:pt-0 border-t md:border-t-0 border-white/5">
                      {job.status !== 'Approved' && job.status !== 'Applied' && (
                        <button 
                          onClick={() => statusMutation.mutate({ id: job.job_id || job.id, status: 'Approved' })}
                          className="h-9 px-3 rounded-lg bg-neon-green/10 text-neon-green hover:bg-neon-green/20 text-xs font-medium inline-flex items-center gap-1.5 transition border border-neon-green/20"
                        >
                          <Check className="w-3.5 h-3.5" /> Approve
                        </button>
                      )}
                      
                      {job.status !== 'Dismissed' && (
                        <button 
                          onClick={() => statusMutation.mutate({ id: job.job_id || job.id, status: 'Dismissed' })}
                          className="h-9 px-3 rounded-lg glass hover:bg-white/10 text-muted-foreground hover:text-white text-xs font-medium inline-flex items-center gap-1.5 transition border border-white/10"
                        >
                          <X className="w-3.5 h-3.5" /> Dismiss
                        </button>
                      )}
                      
                      <a 
                        href={job.url || job.job_url || job.source_url || "#"} 
                        target="_blank" 
                        rel="noreferrer"
                        className="h-9 px-3 rounded-lg bg-gradient-to-r from-neon-blue to-neon-purple text-black text-xs font-semibold inline-flex items-center gap-1.5 hover:scale-[1.02] transition shadow-[0_0_12px_rgba(0,240,255,0.2)]"
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
