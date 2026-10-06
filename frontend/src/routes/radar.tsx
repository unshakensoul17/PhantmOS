import { createFileRoute } from "@tanstack/react-router";
import { AuthGuard } from "../components/AuthGuard";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import {
  Loader2, DollarSign, MapPin, Sparkles, Target, ExternalLink,
  Check, X, Zap, ChevronUp, ChevronDown, Building2, Globe
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence, useMotionValue, useTransform } from "motion/react";

export const Route = createFileRoute("/radar")({
  component: RadarPageWrapper,
});

function scoreStyle(s: number) {
  if (s >= 90) return { color: "text-neon-green", ring: "stroke-neon-green", bg: "bg-neon-green/10 border-neon-green/30" };
  if (s >= 75) return { color: "text-neon-blue",  ring: "stroke-neon-blue",  bg: "bg-neon-blue/10 border-neon-blue/30" };
  return { color: "text-neon-amber", ring: "stroke-neon-amber", bg: "bg-neon-amber/10 border-neon-amber/30" };
}

function getLocationBadge(location: string = "") {
  const loc = (location || "").toLowerCase();
  if (loc.includes("remote") || loc.includes("anywhere") || loc.includes("global") || !loc) {
    return { label: "Remote", color: "bg-neon-green/10 text-neon-green border-neon-green/30", icon: Globe };
  }
  if (loc.includes("hybrid")) {
    return { label: "Hybrid", color: "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30", icon: MapPin };
  }
  return { label: location, color: "bg-white/5 text-muted-foreground border-white/10", icon: Building2 };
}

function triggerHaptic(type: "light" | "medium" | "heavy" | "success" | "warning" | "error" = "medium") {
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

function RadarPageWrapper() {
  return (
    <AuthGuard>
      <RadarPage />
    </AuthGuard>
  );
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 320 : -320,
    opacity: 0,
    scale: 0.92,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
    scale: 1,
    transition: {
      x: { type: "spring", stiffness: 350, damping: 30 },
      opacity: { duration: 0.2 },
      scale: { duration: 0.2 },
    },
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 320 : -320,
    opacity: 0,
    scale: 0.92,
    transition: {
      x: { type: "spring", stiffness: 350, damping: 30 },
      opacity: { duration: 0.2 },
      scale: { duration: 0.2 },
    },
  }),
};

function RadarPage() {
  const queryClient = useQueryClient();
  const [[page, direction], setPage] = useState([0, 0]);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useInfiniteQuery({
    queryKey: ["leads", "Found"],
    initialPageParam: "",
    queryFn: async ({ pageParam = "" }) => {
      const url = new URL("/api/leads", window.location.origin);
      url.searchParams.set("status", "Found");
      if (pageParam) url.searchParams.set("cursor", pageParam);
      url.searchParams.set("limit", "15");
      const res = await apiFetch(url.pathname + url.search);
      if (!res.ok) throw new Error("Failed to fetch leads");
      return res.json();
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage || lastPage.length < 15) return undefined;
      return lastPage[lastPage.length - 1].created_at;
    }
  });

  const leads = data?.pages.flatMap(page => page) || [];
  const currentIndex = Math.max(0, Math.min(page, Math.max(0, leads.length - 1)));
  const activeLead = leads[currentIndex];

  const paginate = (newDirection: number) => {
    const targetIndex = currentIndex + newDirection;
    if (targetIndex < 0 || targetIndex >= leads.length) return;
    triggerHaptic("light");
    setPage([targetIndex, newDirection]);

    if (targetIndex >= leads.length - 3 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

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

  const harvestMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/harvest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "" }),
      });
      if (!res.ok) throw new Error("Failed to trigger harvest");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Discovery engine launched!");
      refetch();
    }
  });

  const handleApprove = (job: any) => {
    const jobId = job.job_id || job.id;
    triggerHaptic("success");
    toast.success(`Approved ${job.company}!`);
    statusMutation.mutate({ id: jobId, status: "Approved" });
    if (currentIndex < leads.length - 1) {
      paginate(1);
    }
  };

  const handleDismiss = (job: any) => {
    const jobId = job.job_id || job.id;
    triggerHaptic("medium");
    toast.info(`Dismissed ${job.company}`);
    statusMutation.mutate({ id: jobId, status: "Dismissed" });
    if (currentIndex < leads.length - 1) {
      paginate(1);
    }
  };

  const handleGenerate = async (job: any) => {
    const jobId = job.job_id || job.id;
    setGeneratingFor(jobId);
    triggerHaptic("heavy");
    try {
      const res = await apiFetch(`/api/leads/${jobId}/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Resume tailoring failed");
      }
      const data = await res.json();
      toast.success("Tailored ATS resume generated!");
      if (data.resume_url) {
        window.open(data.resume_url, "_blank");
      }
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      if (currentIndex < leads.length - 1) {
        paginate(1);
      }
    } catch (err: any) {
      toast.error(err.message || "Resume generation failed");
    } finally {
      setGeneratingFor(null);
    }
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeLead || generatingFor) return;
      if (e.key === "ArrowLeft") paginate(-1);
      if (e.key === "ArrowRight") paginate(1);
      if (e.key === "ArrowUp" || e.key === " ") {
        e.preventDefault();
        handleGenerate(activeLead);
      }
      if (e.key === "Enter") handleApprove(activeLead);
      if (e.key === "Escape") handleDismiss(activeLead);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeLead, generatingFor, currentIndex, leads.length]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between select-none overflow-hidden touch-none pb-6">
      {/* Top Navbar */}
      <div className="w-full bg-background/80 backdrop-blur-md border-b border-white/5 px-4 py-3 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse" />
          <h1 className="text-lg font-bold font-unbounded bg-gradient-to-r from-neon-blue via-neon-cyan to-neon-purple bg-clip-text text-transparent">
            PhantmOS Radar
          </h1>
        </div>

        {leads.length > 0 && (
          <span className="text-xs text-muted-foreground font-mono px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
            {currentIndex + 1} / {leads.length}
          </span>
        )}
      </div>

      {/* Main Swipeable Arena */}
      <div className="flex-1 flex items-center justify-center p-4 relative max-w-sm w-full mx-auto my-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-neon-cyan" />
            <p className="font-mono text-xs tracking-wider uppercase text-neon-cyan">Scanning Live Radar...</p>
          </div>
        ) : leads.length === 0 ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center p-6 glass-strong rounded-3xl border border-white/10 max-w-xs shadow-2xl space-y-4"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-neon-cyan/20 to-neon-blue/10 border border-neon-cyan/30 grid place-items-center mx-auto text-neon-cyan">
              <Target className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-unbounded text-white">Radar Clear</h2>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                All opportunities reviewed. Run another discovery sweep to harvest new roles.
              </p>
            </div>
            <button
              onClick={() => harvestMutation.mutate()}
              disabled={harvestMutation.isPending}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-neon-blue to-neon-purple text-black font-semibold text-xs tracking-wider uppercase flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-98 transition shadow-[0_0_20px_rgba(0,240,255,0.3)] disabled:opacity-50"
            >
              {harvestMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {harvestMutation.isPending ? "Harvesting..." : "Scan Opportunities"}
            </button>
          </motion.div>
        ) : (
          <div className="relative w-full h-[500px] flex items-center justify-center">
            <AnimatePresence initial={false} custom={direction} mode="wait">
              {activeLead && (
                <SwipeableCard
                  key={activeLead.job_id || activeLead.id}
                  job={activeLead}
                  direction={direction}
                  onSwipeLeft={() => paginate(1)}
                  onSwipeRight={() => paginate(-1)}
                  hasPrev={currentIndex > 0}
                  hasNext={currentIndex < leads.length - 1}
                />
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Clean 3-Button Action Bar */}
      {leads.length > 0 && activeLead && (
        <div className="w-full max-w-sm mx-auto px-6 pb-2 shrink-0 z-20">
          <div className="flex items-center justify-center gap-6">
            {/* Dismiss Button */}
            <button
              onClick={() => handleDismiss(activeLead)}
              className="w-14 h-14 rounded-full glass border border-neon-pink/30 text-neon-pink flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all bg-neon-pink/5 hover:bg-neon-pink/15"
              aria-label="Dismiss Opportunity"
              title="Dismiss lead"
            >
              <X className="w-6 h-6 stroke-[2.5]" />
            </button>

            {/* Quick Resume Generator */}
            <button
              onClick={() => handleGenerate(activeLead)}
              disabled={generatingFor === (activeLead.job_id || activeLead.id)}
              className="w-16 h-16 rounded-full glass border border-neon-cyan/40 text-neon-cyan flex items-center justify-center shadow-[0_0_25px_rgba(0,240,255,0.25)] hover:scale-110 active:scale-95 transition-all bg-neon-cyan/15 hover:bg-neon-cyan/25 disabled:opacity-50"
              aria-label="Tailor Resume"
              title="Generate tailored ATS resume"
            >
              {generatingFor === (activeLead.job_id || activeLead.id) ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Zap className="w-6 h-6" />
              )}
            </button>

            {/* Approve Button */}
            <button
              onClick={() => handleApprove(activeLead)}
              className="w-14 h-14 rounded-full glass border border-neon-green/30 text-neon-green flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all bg-neon-green/5 hover:bg-neon-green/15"
              aria-label="Approve Opportunity"
              title="Approve lead"
            >
              <Check className="w-6 h-6 stroke-[2.5]" />
            </button>
          </div>
          <p className="text-center text-[10px] text-muted-foreground font-mono mt-3">
            Swipe Left/Right to Browse Cards
          </p>
        </div>
      )}
    </div>
  );
}

function SwipeableCard({
  job,
  direction,
  onSwipeLeft,
  onSwipeRight,
  hasPrev,
  hasNext,
}: {
  job: any;
  direction: number;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const s = scoreStyle(job.score_total || 0);
  const locBadge = getLocationBadge(job.location);
  const LocIcon = locBadge.icon;

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-250, 250], [-8, 8]);

  const handleDragEnd = (_: any, info: any) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    // Swiping left (drag left) -> Next card
    if ((offset < -50 || velocity < -300) && hasNext) {
      onSwipeLeft();
    }
    // Swiping right (drag right) -> Previous card
    else if ((offset > 50 || velocity > 300) && hasPrev) {
      onSwipeRight();
    }
  };

  const circ = 2 * Math.PI * 18;
  const dash = ((job.score_total || 0) / 100) * circ;

  return (
    <motion.div
      custom={direction}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.6}
      onDragEnd={handleDragEnd}
      className="absolute inset-0 w-full h-[470px] glass-strong rounded-3xl border border-white/10 shadow-2xl flex flex-col justify-between overflow-hidden cursor-grab active:cursor-grabbing backdrop-blur-xl bg-black/75"
    >
      {/* Card Header & Scores */}
      <div className="p-5 pb-2">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0 pr-2">
            <h2 className="text-lg font-bold font-unbounded leading-snug text-white line-clamp-2" title={job.title}>
              {job.title}
            </h2>
            <div className="text-sm font-semibold text-neon-cyan mt-1 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{job.company}</span>
            </div>
          </div>

          {/* Radial Match Score */}
          <div className="relative w-12 h-12 shrink-0">
            <svg viewBox="0 0 44 44" className="w-12 h-12 -rotate-90">
              <circle cx="22" cy="22" r="18" strokeWidth="3" fill="none" className="stroke-white/10" />
              <circle
                cx="22" cy="22" r="18" strokeWidth="3" fill="none"
                className={s.ring}
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circ}`}
                style={{ filter: "drop-shadow(0 0 6px currentColor)" }}
              />
            </svg>
            <div className={`absolute inset-0 grid place-items-center font-mono font-bold text-xs ${s.color}`}>
              {job.score_total || 0}
            </div>
          </div>
        </div>

        {/* Metadata Badges */}
        <div className="flex items-center gap-2 flex-wrap text-xs mt-2">
          {job.score_band && (
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border font-semibold ${
              ['A', 'HOT'].includes(job.score_band?.toUpperCase()) ? "bg-neon-green/15 text-neon-green border-neon-green/30" : 
              ['B', 'WARM'].includes(job.score_band?.toUpperCase()) ? "bg-neon-blue/15 text-neon-blue border-neon-blue/30" :
              "bg-neon-amber/15 text-neon-amber border-neon-amber/30"
            }`}>
              {job.score_band.toUpperCase()} MATCH
            </span>
          )}
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border flex items-center gap-1 ${locBadge.color}`}>
            <LocIcon className="w-3 h-3" />
            {job.location || locBadge.label}
          </span>
          {job.salary && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md border bg-white/5 border-white/10 text-neon-green flex items-center gap-0.5">
              <DollarSign className="w-3 h-3" />
              {job.salary}
            </span>
          )}
        </div>
      </div>

      {/* AI Assessment & Description */}
      <div className="px-5 py-2 flex-1 overflow-y-auto no-scrollbar">
        <div className={`p-3 rounded-2xl border ${s.bg} bg-black/40 mb-3`}>
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-neon-cyan mb-1.5 font-semibold">
            <Sparkles className={`w-3.5 h-3.5 ${s.color}`} />
            <span>AI Match Rationale</span>
          </div>
          <p className="text-xs text-white/90 leading-relaxed">
            {job.justification || "Matches your target technical stack and seniority background."}
          </p>
        </div>

        {/* Expandable Deep Intel */}
        {expanded && job.raw_description && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="text-xs text-muted-foreground leading-relaxed pt-2 border-t border-white/10"
          >
            <div className="font-mono text-[11px] text-white/70 mb-1 uppercase font-semibold">Job Overview</div>
            <p className="line-clamp-6">{job.raw_description.replace(/<[^>]*>?/gm, "")}</p>
          </motion.div>
        )}
      </div>

      {/* Card Footer */}
      <div className="p-4 pt-2 border-t border-white/5 flex items-center justify-between gap-2 shrink-0 bg-black/30">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="text-[11px] font-mono text-muted-foreground hover:text-white flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-white/5 transition"
        >
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          {expanded ? "Less Info" : "Expand Description"}
        </button>

        <a
          href={job.url || job.job_url || job.source_url || "#"}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-[11px] font-mono text-neon-cyan hover:text-white flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-neon-cyan/10 transition"
        >
          Original Post <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </motion.div>
  );
}
