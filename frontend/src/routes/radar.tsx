import { createFileRoute } from "@tanstack/react-router";
import { AuthGuard } from "../components/AuthGuard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import {
  Loader2,
  DollarSign,
  MapPin,
  Sparkles,
  Target,
  ExternalLink,
  Check,
  X,
  Zap,
  ChevronUp,
  ChevronDown,
  Building2,
  Globe,
  RotateCcw,
  Download,
  Eye,
  Heart,
  FileText,
  Send,
  BarChart2,
  Copy,
  CheckCheck,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";

export const Route = createFileRoute("/radar")({
  component: RadarPageWrapper,
});

function scoreStyle(s: number) {
  if (s >= 88)
    return {
      color: "text-neon-green",
      ring: "stroke-neon-green",
      bg: "bg-neon-green/10 border-neon-green/30",
      badge: "bg-neon-green/15 text-neon-green border-neon-green/30",
      label: "HOT MATCH",
      emoji: "🔥",
    };
  if (s >= 70)
    return {
      color: "text-neon-blue",
      ring: "stroke-neon-blue",
      bg: "bg-neon-blue/10 border-neon-blue/30",
      badge: "bg-neon-blue/15 text-neon-blue border-neon-blue/30",
      label: "GOOD MATCH",
      emoji: "🟢",
    };
  return {
    color: "text-white/70",
    ring: "stroke-white/40",
    bg: "bg-white/5 border-white/10",
    badge: "bg-white/10 text-white/80 border-white/20",
    label: "MATCH",
    emoji: "⚪",
  };
}

function getLocationBadge(location: string = "") {
  const loc = (location || "").toLowerCase();
  if (loc.includes("remote") || loc.includes("anywhere") || loc.includes("global") || !loc) {
    return {
      label: "Remote",
      color: "bg-neon-green/10 text-neon-green border-neon-green/30",
      icon: Globe,
    };
  }
  if (loc.includes("hybrid")) {
    return {
      label: "Hybrid",
      color: "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30",
      icon: MapPin,
    };
  }
  return {
    label: location,
    color: "bg-white/5 text-muted-foreground border-white/10",
    icon: Building2,
  };
}

function triggerHaptic(
  type: "light" | "medium" | "heavy" | "success" | "warning" | "error" = "medium",
) {
  try {
    const tg = (window as any).Telegram?.WebApp?.HapticFeedback;
    if (tg) {
      if (type === "success" || type === "warning" || type === "error") {
        tg.notificationOccurred(type);
      } else {
        tg.impactOccurred(type);
      }
      return;
    }
  } catch {}
  if (typeof window !== "undefined" && window.navigator?.vibrate) {
    window.navigator.vibrate(type === "heavy" ? 40 : 20);
  }
}

function extractBullets(job: any): string[] {
  const bullets: string[] = [];
  let notes: any = {};
  try {
    notes = typeof job.notes === "string" ? JSON.parse(job.notes) : job.notes || {};
  } catch {}

  let breakdown: any = {};
  try {
    breakdown =
      typeof job.score_breakdown === "string"
        ? JSON.parse(job.score_breakdown)
        : job.score_breakdown || {};
  } catch {}

  if (notes.rationale) {
    const parts = notes.rationale
      .split(/[.·•\n]/)
      .map((s: string) => s.trim())
      .filter(Boolean);
    bullets.push(...parts.slice(0, 3));
  }

  if (bullets.length < 3 && breakdown.matched_skills && Array.isArray(breakdown.matched_skills)) {
    bullets.push(
      ...breakdown.matched_skills
        .map((s: string) => `Strong alignment with ${s}`)
        .slice(0, 3 - bullets.length),
    );
  }

  if (bullets.length < 3) {
    const defaults = [
      "Tech stack & core dependencies match your target role",
      "Direct seniority & experience requirement alignment",
      "Verified active engineering vacancy",
    ];
    for (const d of defaults) {
      if (bullets.length >= 3) break;
      bullets.push(d);
    }
  }

  return bullets.slice(0, 3);
}

function getPhantmOSSuggestion(score: number): string {
  if (score >= 88) return "Strong fit — prioritize this application.";
  if (score >= 70) return "Solid technical overlap — tailored resume recommended.";
  return "Transferable skills match — review requirements closely.";
}

function RadarPageWrapper() {
  return (
    <AuthGuard>
      <RadarPage />
    </AuthGuard>
  );
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 280 : -280,
    opacity: 0,
    scale: 0.94,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
    scale: 1,
    transition: {
      x: { type: "spring" as const, stiffness: 350, damping: 30 },
      opacity: { duration: 0.18 },
      scale: { duration: 0.18 },
    },
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 280 : -280,
    opacity: 0,
    scale: 0.94,
    transition: {
      x: { type: "spring" as const, stiffness: 350, damping: 30 },
      opacity: { duration: 0.18 },
      scale: { duration: 0.18 },
    },
  }),
};

type ActiveTab = "radar" | "saved" | "resumes" | "applications";

interface LastAction {
  job: any;
  type: "saved" | "passed";
  index: number;
}

function RadarPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ActiveTab>("radar");
  const [[currentIndex, direction], setPageIndex] = useState([0, 0]);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<LastAction | null>(null);
  const [sessionStats, setSessionStats] = useState({ tailored: 0, saved: 0, passed: 0 });
  const [tailoredLead, setTailoredLead] = useState<any | null>(null);

  // Initialize Telegram WebApp in Compact mode (do not force fullscreen expansion)
  useEffect(() => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        tg.ready();
        tg.disableVerticalSwipes?.();
        tg.enableClosingConfirmation?.();
        tg.setHeaderColor?.("#0a0d14");
        tg.setBackgroundColor?.("#0a0d14");
      }
    } catch {}
  }, []);

  // Fetch pending radar leads
  const {
    data: leads = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["leads", "Found"],
    queryFn: async () => {
      const res = await apiFetch("/api/leads?status=Found&limit=30");
      if (!res.ok) throw new Error("Failed to fetch leads");
      return res.json();
    },
  });

  // Fetch saved/approved leads for Saved tab
  const { data: savedLeads = [] } = useQuery({
    queryKey: ["leads", "Approved"],
    queryFn: async () => {
      const res = await apiFetch("/api/leads?status=Approved&limit=30");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: activeTab === "saved",
  });

  // Fetch tailored leads for Resumes tab
  const { data: tailoredLeads = [] } = useQuery({
    queryKey: ["leads", "Tailored"],
    queryFn: async () => {
      const res = await apiFetch("/api/leads?status=Tailored&limit=30");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: activeTab === "resumes",
  });

  // Fetch applied leads for Applications tab
  const { data: appliedLeads = [] } = useQuery({
    queryKey: ["leads", "Applied"],
    queryFn: async () => {
      const res = await apiFetch("/api/leads?status=Applied&limit=30");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: activeTab === "applications",
  });

  const activeLead = leads[currentIndex] || null;

  // Auto-advance helper
  const advanceToNext = (dir: number = 1) => {
    setTailoredLead(null);
    setPageIndex([currentIndex + dir, dir]);
  };

  // Status mutation
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

  // Harvest mutation
  const harvestMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/harvest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "" }),
      });
      if (!res.ok) throw new Error("Failed to launch harvester");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Scanning fresh opportunities...");
      refetch();
    },
  });

  // Save action (Decision: ❤️ Save -> auto next)
  const handleSave = (job: any) => {
    const jobId = job.job_id || job.id;
    triggerHaptic("success");
    statusMutation.mutate({ id: jobId, status: "Approved" });
    setSessionStats((prev) => ({ ...prev, saved: prev.saved + 1 }));
    setLastAction({ job, type: "saved", index: currentIndex });
    advanceToNext(1);
  };

  // Pass action (Decision: ❌ Pass -> auto next)
  const handlePass = (job: any) => {
    const jobId = job.job_id || job.id;
    triggerHaptic("light");
    statusMutation.mutate({ id: jobId, status: "Dismissed" });
    setSessionStats((prev) => ({ ...prev, passed: prev.passed + 1 }));
    setLastAction({ job, type: "passed", index: currentIndex });
    advanceToNext(1);
  };

  // Tailor Resume action (⚡ Tailor Resume)
  const handleTailor = async (job: any) => {
    const jobId = job.job_id || job.id;
    setGeneratingFor(jobId);
    triggerHaptic("heavy");
    try {
      const res = await apiFetch(`/api/leads/${jobId}/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Resume tailoring failed");
      }
      const data = await res.json();
      triggerHaptic("success");
      toast.success("Tailored ATS resume created!");
      setSessionStats((prev) => ({ ...prev, tailored: prev.tailored + 1 }));
      setTailoredLead({ ...job, resume_url: data.resume_url, status: "Tailored" });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    } catch (err: any) {
      toast.error(err.message || "Resume generation failed");
    } finally {
      setGeneratingFor(null);
    }
  };

  // Undo action (↩️ Undo latest decision)
  const handleUndo = async () => {
    if (!lastAction) return;
    triggerHaptic("medium");
    const { job, type, index } = lastAction;
    const jobId = job.job_id || job.id;

    try {
      await apiFetch(`/api/leads/${jobId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Found" }),
      });
      if (type === "saved") {
        setSessionStats((prev) => ({ ...prev, saved: Math.max(0, prev.saved - 1) }));
      } else {
        setSessionStats((prev) => ({ ...prev, passed: Math.max(0, prev.passed - 1) }));
      }
      setPageIndex([index, -1]);
      setLastAction(null);
      toast.info(`Restored ${job.company}`);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    } catch {
      toast.error("Failed to undo action");
    }
  };

  // Auto-hide undo toast after 5 seconds
  useEffect(() => {
    if (!lastAction) return;
    const timer = setTimeout(() => setLastAction(null), 5000);
    return () => clearTimeout(timer);
  }, [lastAction]);

  return (
    <div className="min-h-screen bg-[#07090e] text-white flex flex-col justify-between select-none overflow-hidden pb-4 overscroll-none touch-pan-y">
      {/* Top Compact Header & Tab Switcher */}
      <header className="w-full bg-[#0a0d14]/90 backdrop-blur-md border-b border-white/5 px-4 py-2.5 shrink-0 z-30">
        <div className="flex items-center justify-between gap-2 max-w-md mx-auto">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse shadow-[0_0_8px_#00f0ff]" />
            <h1 className="text-base font-bold font-unbounded bg-gradient-to-r from-neon-blue via-neon-cyan to-neon-purple bg-clip-text text-transparent">
              PhantmOS
            </h1>
          </div>

          {/* Navigation Pill Tabs */}
          <nav className="flex items-center gap-1 bg-white/5 p-0.5 rounded-full border border-white/10 text-[11px] font-mono">
            <button
              onClick={() => setActiveTab("radar")}
              className={`px-2.5 py-1 rounded-full transition ${
                activeTab === "radar"
                  ? "bg-neon-cyan/20 text-neon-cyan font-bold"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              🎯 Radar
            </button>
            <button
              onClick={() => setActiveTab("saved")}
              className={`px-2 py-1 rounded-full transition ${
                activeTab === "saved"
                  ? "bg-neon-pink/20 text-neon-pink font-bold"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              ❤️ Saved
            </button>
            <button
              onClick={() => setActiveTab("resumes")}
              className={`px-2 py-1 rounded-full transition ${
                activeTab === "resumes"
                  ? "bg-neon-green/20 text-neon-green font-bold"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              📄 Resumes
            </button>
            <button
              onClick={() => setActiveTab("applications")}
              className={`px-2 py-1 rounded-full transition ${
                activeTab === "applications"
                  ? "bg-neon-purple/20 text-neon-purple font-bold"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              📤 Applied
            </button>
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-3 relative max-w-md w-full mx-auto my-auto overflow-hidden">
        {activeTab === "radar" &&
          (isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="w-9 h-9 animate-spin mb-3 text-neon-cyan" />
              <p className="font-mono text-xs tracking-wider uppercase text-neon-cyan">
                Scanning Live Radar...
              </p>
            </div>
          ) : !activeLead || currentIndex >= leads.length ? (
            /* Radar Complete Screen */
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center p-6 glass-strong rounded-3xl border border-white/10 max-w-sm w-full shadow-2xl space-y-4"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-neon-cyan/20 to-neon-blue/10 border border-neon-cyan/30 grid place-items-center mx-auto text-neon-cyan">
                <Target className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl font-bold font-unbounded text-white">🎉 Radar Complete</h2>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  You've reviewed all {leads.length} opportunities in this queue.
                </p>
              </div>

              {/* Session Summary Counts */}
              <div className="grid grid-cols-3 gap-2 py-2 bg-white/5 rounded-2xl border border-white/10 text-center">
                <div className="p-2">
                  <div className="text-lg font-bold font-mono text-neon-cyan">
                    {sessionStats.tailored}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase font-mono mt-0.5">
                    ⚡ Resumes
                  </div>
                </div>
                <div className="p-2 border-x border-white/10">
                  <div className="text-lg font-bold font-mono text-neon-pink">
                    {sessionStats.saved}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase font-mono mt-0.5">
                    ❤️ Saved
                  </div>
                </div>
                <div className="p-2">
                  <div className="text-lg font-bold font-mono text-white/60">
                    {sessionStats.passed}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase font-mono mt-0.5">
                    ❌ Passed
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  onClick={() => harvestMutation.mutate()}
                  disabled={harvestMutation.isPending}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-neon-blue to-neon-purple text-black font-semibold text-xs tracking-wider uppercase flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-98 transition shadow-[0_0_20px_rgba(0,240,255,0.3)] disabled:opacity-50"
                >
                  {harvestMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {harvestMutation.isPending ? "Harvesting..." : "Scan New Opportunities"}
                </button>
                <button
                  onClick={() => setActiveTab("saved")}
                  className="w-full py-2.5 rounded-xl glass border border-white/10 text-xs font-mono text-white/80 hover:text-white flex items-center justify-center gap-1.5 transition"
                >
                  ❤️ View Saved Jobs ({sessionStats.saved})
                </button>
              </div>
            </motion.div>
          ) : (
            /* Decision-First Compact Card */
            <div className="relative w-full h-[510px] flex items-center justify-center">
              <AnimatePresence initial={false} custom={direction} mode="wait">
                <CompactDecisionCard
                  key={activeLead.job_id || activeLead.id}
                  job={activeLead}
                  direction={direction}
                  currentIndex={currentIndex}
                  totalCount={leads.length}
                  isGenerating={generatingFor === (activeLead.job_id || activeLead.id)}
                  tailoredResult={tailoredLead}
                  onTailor={() => handleTailor(activeLead)}
                  onSave={() => handleSave(activeLead)}
                  onPass={() => handlePass(activeLead)}
                  onNext={() => advanceToNext(1)}
                />
              </AnimatePresence>
            </div>
          ))}

        {/* Tab: Saved Jobs */}
        {activeTab === "saved" && (
          <div className="w-full h-[510px] overflow-y-auto no-scrollbar space-y-2.5 p-1">
            <h2 className="text-sm font-bold font-unbounded text-neon-pink flex items-center gap-2 mb-3">
              <Heart className="w-4 h-4 fill-neon-pink" /> Saved Opportunities ({savedLeads.length})
            </h2>
            {savedLeads.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-xs">
                No saved jobs yet. Tap ❤️ on Radar cards to bookmark them.
              </div>
            ) : (
              savedLeads.map((job: any) => (
                <div
                  key={job.job_id || job.id}
                  className="p-3 rounded-2xl glass border border-white/10 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs font-bold text-white truncate">{job.title}</h3>
                    <p className="text-[11px] text-neon-cyan truncate">{job.company}</p>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {job.location || "Remote"}
                    </span>
                  </div>
                  <button
                    onClick={() => handleTailor(job)}
                    className="px-3 py-1.5 rounded-xl bg-neon-cyan/20 border border-neon-cyan/40 text-neon-cyan text-xs font-mono font-semibold hover:bg-neon-cyan/30 transition shrink-0"
                  >
                    ⚡ Tailor
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab: Resumes */}
        {activeTab === "resumes" && (
          <div className="w-full h-[510px] overflow-y-auto no-scrollbar space-y-2.5 p-1">
            <h2 className="text-sm font-bold font-unbounded text-neon-green flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4" /> Tailored Resumes ({tailoredLeads.length})
            </h2>
            {tailoredLeads.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-xs">
                No tailored resumes yet. Tap ⚡ Tailor Resume on any match.
              </div>
            ) : (
              tailoredLeads.map((job: any) => (
                <div
                  key={job.job_id || job.id}
                  className="p-3 rounded-2xl glass border border-white/10 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs font-bold text-white truncate">{job.title}</h3>
                    <p className="text-[11px] text-neon-cyan truncate">{job.company}</p>
                  </div>
                  {job.resume_url ? (
                    <a
                      href={job.resume_url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-neon-green/20 border border-neon-green/40 text-neon-green text-xs font-mono font-semibold flex items-center gap-1.5 hover:bg-neon-green/30 transition shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" /> PDF
                    </a>
                  ) : (
                    <span className="text-[10px] text-muted-foreground font-mono">Generating</span>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab: Applications */}
        {activeTab === "applications" && (
          <div className="w-full h-[510px] overflow-y-auto no-scrollbar space-y-2.5 p-1">
            <h2 className="text-sm font-bold font-unbounded text-neon-purple flex items-center gap-2 mb-3">
              <Send className="w-4 h-4" /> Dispatched Applications ({appliedLeads.length})
            </h2>
            {appliedLeads.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-xs">
                No sent applications yet.
              </div>
            ) : (
              appliedLeads.map((job: any) => (
                <div
                  key={job.job_id || job.id}
                  className="p-3 rounded-2xl glass border border-white/10 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs font-bold text-white truncate">{job.title}</h3>
                    <p className="text-[11px] text-neon-cyan truncate">{job.company}</p>
                    <span className="text-[10px] text-neon-green font-mono">✅ Dispatched</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* Floating Lightweight Undo Toast */}
      <AnimatePresence>
        {lastAction && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-4 inset-x-4 max-w-sm mx-auto z-50 p-2.5 rounded-2xl glass-strong border border-white/15 shadow-2xl flex items-center justify-between gap-3 bg-black/90 backdrop-blur-xl"
          >
            <div className="text-xs text-white/90 truncate pl-2">
              <span className="font-semibold text-white">{lastAction.job.company}</span>{" "}
              {lastAction.type === "saved" ? (
                <span className="text-neon-pink font-mono">saved ❤️</span>
              ) : (
                <span className="text-muted-foreground font-mono">passed ❌</span>
              )}
            </div>
            <button
              onClick={handleUndo}
              className="px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono text-xs font-bold flex items-center gap-1.5 transition active:scale-95 border border-white/10"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Undo
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                        COMPACT DECISION CARD COMPONENT                      */
/* -------------------------------------------------------------------------- */

function CompactDecisionCard({
  job,
  direction,
  currentIndex,
  totalCount,
  isGenerating,
  tailoredResult,
  onTailor,
  onSave,
  onPass,
  onNext,
}: {
  job: any;
  direction: number;
  currentIndex: number;
  totalCount: number;
  isGenerating: boolean;
  tailoredResult: any | null;
  onTailor: () => void;
  onSave: () => void;
  onPass: () => void;
  onNext: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const rawScore = job.match_score || job.score_total || 0;
  const score = Math.round(rawScore <= 1.0 ? rawScore * 100 : rawScore);
  const s = scoreStyle(score);
  const locBadge = getLocationBadge(job.location);
  const LocIcon = locBadge.icon;
  const bullets = extractBullets(job);
  const suggestion = getPhantmOSSuggestion(score);

  let notes: any = {};
  try {
    notes = typeof job.notes === "string" ? JSON.parse(job.notes) : job.notes || {};
  } catch {}

  const handleCopyEmail = () => {
    const coldEmail =
      notes.cold_email || `Hi ${job.company} Team,\n\nI am applying for the ${job.title} role.`;
    navigator.clipboard.writeText(coldEmail);
    setCopiedEmail(true);
    triggerHaptic("light");
    toast.success("Cold email copied!");
    setTimeout(() => setCopiedEmail(false), 3000);
  };

  return (
    <motion.div
      custom={direction}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      className="absolute inset-x-0 inset-y-0 h-[495px] glass-strong rounded-3xl border border-white/10 shadow-2xl flex flex-col justify-between overflow-hidden backdrop-blur-2xl bg-[#0d111a]/95"
    >
      {/* 1. Header Banner: Score & Role */}
      <div className="p-4 pb-2 border-b border-white/5">
        <div className="flex items-center justify-between gap-2 mb-2">
          {/* Match Score Banner Badge */}
          <span
            className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full border font-bold flex items-center gap-1 ${s.badge}`}
          >
            <span>{s.emoji}</span>
            <span>
              {score}% {s.label}
            </span>
          </span>

          {/* Progress Indicator: 1 of 14 */}
          <span className="text-[11px] font-mono text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
            {currentIndex + 1} of {totalCount}
          </span>
        </div>

        {/* Title & Company */}
        <h2
          className="text-base font-bold font-unbounded text-white leading-tight line-clamp-1"
          title={job.title}
        >
          {job.title}
        </h2>
        <div className="text-xs font-semibold text-neon-cyan mt-1 flex items-center gap-2">
          <Building2 className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{job.company}</span>
          <span className="text-white/20">·</span>
          <span className="text-muted-foreground flex items-center gap-1 font-normal">
            <LocIcon className="w-3 h-3" />
            {job.location || locBadge.label}
          </span>
          {job.salary && (
            <>
              <span className="text-white/20">·</span>
              <span className="text-neon-green font-mono text-[10px]">{job.salary}</span>
            </>
          )}
        </div>
      </div>

      {/* 2. Middle Body: Why You Match & PhantmOS Suggests */}
      <div className="px-4 py-2.5 flex-1 overflow-y-auto no-scrollbar space-y-2.5">
        {/* If Tailored Resume is ready for this lead */}
        {tailoredResult ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-3.5 rounded-2xl bg-neon-green/10 border border-neon-green/30 space-y-2.5 text-center"
          >
            <div className="w-9 h-9 rounded-full bg-neon-green/20 text-neon-green grid place-items-center mx-auto">
              <Check className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white font-unbounded">Tailored Resume Ready</h3>
              <p className="text-[11px] text-neon-green font-mono mt-0.5">
                Optimized for {job.company}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              <a
                href={tailoredResult.resume_url}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-xl bg-neon-green text-black font-semibold text-xs font-mono flex items-center gap-1 shadow-[0_0_12px_rgba(0,255,136,0.3)] hover:scale-105 transition"
              >
                <Download className="w-3.5 h-3.5" /> Download PDF
              </a>
              <button
                onClick={onNext}
                className="px-3 py-1.5 rounded-xl glass border border-white/20 text-xs font-mono text-white hover:bg-white/10 transition"
              >
                Next Job ➡️
              </button>
            </div>
          </motion.div>
        ) : (
          /* Standard Decision Intel */
          <>
            {/* If currently tailoring in background, show active indicator banner */}
            {isGenerating && (
              <div className="p-2.5 rounded-xl bg-neon-cyan/10 border border-neon-cyan/30 flex items-center gap-2 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-neon-cyan shrink-0" />
                <div className="text-[11px] text-neon-cyan font-mono leading-tight">
                  <span className="font-bold">Tailoring ATS resume in background...</span>
                  <div className="text-[10px] text-white/70">You can continue deciding on other jobs!</div>
                </div>
              </div>
            )}

            {/* Why You Match Bullets */}
            <div className="p-3 rounded-2xl glass border border-white/10 space-y-1.5 bg-black/40">
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-neon-cyan font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-neon-cyan" />
                <span>Why you match:</span>
              </div>
              <ul className="space-y-1 text-xs text-white/90">
                {bullets.map((b, idx) => (
                  <li key={idx} className="flex items-start gap-1.5 leading-snug">
                    <span className="text-neon-cyan font-bold">•</span>
                    <span className="line-clamp-2">{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* PhantmOS Suggests */}
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-start gap-2">
              <Zap className="w-4 h-4 text-neon-amber shrink-0 mt-0.5" />
              <div className="text-[11px] text-white/80 leading-snug">
                <span className="font-semibold text-white">PhantmOS suggests:</span> {suggestion}
              </div>
            </div>

            {/* Expandable Deep Intel Section */}
            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="pt-2 border-t border-white/10 space-y-2 text-xs text-muted-foreground"
              >
                {job.raw_description && (
                  <div>
                    <div className="text-[10px] font-mono uppercase font-bold text-white/70 mb-1">
                      Job Overview
                    </div>
                    <p className="line-clamp-4 leading-relaxed bg-black/30 p-2 rounded-xl text-[11px] text-white/80">
                      {job.raw_description.replace(/<[^>]*>?/gm, "")}
                    </p>
                  </div>
                )}

                {/* Direct JD Link & Cold Email Helper */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <a
                    href={job.url || job.job_url || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-mono text-neon-cyan hover:underline flex items-center gap-1"
                  >
                    Original Posting <ExternalLink className="w-3 h-3" />
                  </a>

                  <button
                    onClick={handleCopyEmail}
                    className="text-[11px] font-mono text-white/80 hover:text-white flex items-center gap-1 bg-white/5 px-2 py-1 rounded-lg border border-white/10 transition active:scale-95"
                  >
                    {copiedEmail ? (
                      <CheckCheck className="w-3 h-3 text-neon-green" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    {copiedEmail ? "Copied" : "Copy Cold Email"}
                  </button>
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>

      {/* 3. Action Bar (Decide -> Action -> Auto Next) */}
      <div className="p-3.5 pt-2 border-t border-white/5 bg-[#0a0d14]/90 shrink-0 space-y-2">
        {!tailoredResult && !isGenerating && (
          <>
            {/* Primary Action Button: Tailor Resume */}
            <button
              onClick={onTailor}
              className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-neon-blue via-neon-cyan to-neon-purple text-black font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-1.5 shadow-[0_0_20px_rgba(0,240,255,0.25)] hover:scale-[1.01] active:scale-98 transition"
            >
              <Zap className="w-4 h-4 fill-black" /> Tailor Resume
            </button>

            {/* Split Rapid Decision Row: Save vs Pass */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onSave}
                className="py-2 px-3 rounded-2xl glass border border-neon-pink/30 text-neon-pink hover:bg-neon-pink/15 text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition active:scale-95"
              >
                <Heart className="w-4 h-4 fill-neon-pink/20" /> Save
              </button>
              <button
                onClick={onPass}
                className="py-2 px-3 rounded-2xl glass border border-white/10 text-muted-foreground hover:text-white hover:bg-white/5 text-xs font-mono font-medium flex items-center justify-center gap-1.5 transition active:scale-95"
              >
                <X className="w-4 h-4 stroke-[2]" /> Pass
              </button>
            </div>
          </>
        )}

        {/* Expand / Less Info Toggle Link */}
        <div className="flex items-center justify-center pt-0.5">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] font-mono text-muted-foreground hover:text-white flex items-center gap-1 transition"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? "Less Info" : "Deep Intel & Full JD"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
