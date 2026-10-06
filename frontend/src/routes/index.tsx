import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useInView, useScroll, useTransform, useSpring } from "motion/react";
import { ArrowRight, ChevronRight } from "lucide-react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

/* ─── Global keyframes + utility classes ─────────────────────────────────── */
function GlobalStyles() {
  return (
    <style>{`
      ::-webkit-scrollbar { width: 0; }

      body { background: #000; font-family: 'Plus Jakarta Sans', sans-serif; }

      @keyframes float-a {
        0%,100% { transform: translateY(0px); }
        50%      { transform: translateY(-18px); }
      }
      @keyframes float-b {
        0%,100% { transform: translateY(0px); }
        50%      { transform: translateY(-12px); }
      }
      @keyframes ring-cw {
        from { transform: translate(-50%,-50%) rotateX(72deg) rotateZ(0deg); }
        to   { transform: translate(-50%,-50%) rotateX(72deg) rotateZ(360deg); }
      }
      @keyframes ring-ccw {
        from { transform: translate(-50%,-50%) rotateX(72deg) rotateZ(0deg); }
        to   { transform: translate(-50%,-50%) rotateX(72deg) rotateZ(-360deg); }
      }
      @keyframes ring-tilt {
        from { transform: translate(-50%,-50%) rotateX(55deg) rotateY(20deg) rotateZ(0deg); }
        to   { transform: translate(-50%,-50%) rotateX(55deg) rotateY(20deg) rotateZ(360deg); }
      }
      @keyframes orbit-eq {
        0%   { transform: translateX(190px) translateY(0px)   scale(1.25); }
        25%  { transform: translateX(0px)   translateY(-72px) scale(0.95); }
        50%  { transform: translateX(-190px) translateY(0px)  scale(0.70); }
        75%  { transform: translateX(0px)   translateY(72px)  scale(0.95); }
        100% { transform: translateX(190px) translateY(0px)   scale(1.25); }
      }
      @keyframes orbit-tilt {
        0%   { transform: translateX(145px)  translateY(-55px) scale(1.05); }
        25%  { transform: translateX(-55px)  translateY(-95px) scale(0.82); }
        50%  { transform: translateX(-145px) translateY(55px)  scale(0.62); }
        75%  { transform: translateX(55px)   translateY(95px)  scale(0.82); }
        100% { transform: translateX(145px)  translateY(-55px) scale(1.05); }
      }
      @keyframes glow-pulse {
        0%,100% { opacity: 0.35; }
        50%      { opacity: 1; }
      }
      @keyframes scan-down {
        0%   { transform: translateY(-4px); opacity: 0; }
        8%   { opacity: 0.12; }
        92%  { opacity: 0.12; }
        100% { transform: translateY(100vh); opacity: 0; }
      }
      @keyframes dash-flow {
        from { stroke-dashoffset: 400; }
        to   { stroke-dashoffset: 0; }
      }

      .glass {
        background: rgba(255,255,255,0.032);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255,255,255,0.075);
      }
      .glass:hover {
        background: rgba(255,255,255,0.055);
        border-color: rgba(255,255,255,0.14);
        transition: background 0.4s ease, border-color 0.4s ease;
      }
      .glass-strong {
        background: rgba(255,255,255,0.055);
        backdrop-filter: blur(30px);
        -webkit-backdrop-filter: blur(30px);
        border: 1px solid rgba(255,255,255,0.12);
      }

      .ring-1 { animation: ring-cw  18s linear infinite; }
      .ring-2 { animation: ring-ccw 26s linear infinite; }
      .ring-3 { animation: ring-tilt 14s linear infinite; }

      .node-eq-0 { animation: orbit-eq    12s linear infinite; }
      .node-eq-1 { animation: orbit-eq    12s linear infinite -4s; }
      .node-eq-2 { animation: orbit-eq    12s linear infinite -8s; }
      .node-tl-0 { animation: orbit-tilt  16s linear infinite; }
      .node-tl-1 { animation: orbit-tilt  16s linear infinite -5.33s; }
      .node-tl-2 { animation: orbit-tilt  16s linear infinite -10.66s; }

      .float-a { animation: float-a 5s ease-in-out infinite; }
      .float-b { animation: float-b 4s ease-in-out infinite; }

      .heading-gradient {
        background: linear-gradient(180deg, #fff 0%, rgba(255,255,255,0.38) 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .glow-btn-white:hover {
        box-shadow: 0 0 40px rgba(255,255,255,0.28);
        transform: scale(1.03);
        transition: transform 0.25s ease, box-shadow 0.25s ease;
      }
      .glow-btn-glass:hover {
        border-color: rgba(255,255,255,0.28) !important;
        transition: border-color 0.3s ease;
      }

      .step-bar {
        height: 1px;
        background: rgba(255,255,255,0.06);
        overflow: hidden;
        border-radius: 999px;
      }
      .step-bar-fill {
        height: 100%;
        background: rgba(255,255,255,0.55);
        transition: width 0.6s cubic-bezier(0.16,1,0.3,1);
      }
    `}</style>
  );
}

/* ─── Particle Canvas ─────────────────────────────────────────────────────── */
type Pt = { x: number; y: number; vx: number; vy: number; a: number; r: number };

function ParticleCanvas({ count = 90, className = "" }: { count?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    let W = (cv.width = cv.offsetWidth);
    let H = (cv.height = cv.offsetHeight);
    const pts: Pt[] = Array.from({ length: count }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.22, vy: (Math.random() - 0.5) * 0.22,
      a: Math.random() * 0.38 + 0.05, r: Math.random() * 1.1 + 0.3,
    }));
    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of pts) {
        p.x = (p.x + p.vx + W) % W;
        p.y = (p.y + p.vy + H) % H;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${p.a})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    const ro = new ResizeObserver(() => { W = cv.width = cv.offsetWidth; H = cv.height = cv.offsetHeight; });
    ro.observe(cv);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [count]);
  return <canvas ref={ref} className={`absolute inset-0 w-full h-full pointer-events-none ${className}`} />;
}

/* ─── Custom Cursor ───────────────────────────────────────────────────────── */
function Cursor() {
  const ring = useRef<HTMLDivElement>(null);
  const dot  = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let mx = 0, my = 0, cx = 0, cy = 0, raf: number;
    const onMove = (e: MouseEvent) => { mx = e.clientX; my = e.clientY; };
    window.addEventListener("mousemove", onMove);
    const tick = () => {
      cx += (mx - cx) * 0.11; cy += (my - cy) * 0.11;
      if (ring.current) ring.current.style.transform = `translate(${cx - 20}px,${cy - 20}px)`;
      if (dot.current)  dot.current.style.transform  = `translate(${mx - 3}px,${my - 3}px)`;
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => { window.removeEventListener("mousemove", onMove); cancelAnimationFrame(raf); };
  }, []);
  return (
    <>
      <div ref={ring} className="fixed top-0 left-0 w-10 h-10 rounded-full pointer-events-none z-[9999]"
        style={{ border: "1px solid rgba(255,255,255,0.35)", mixBlendMode: "difference" }} />
      <div ref={dot} className="fixed top-0 left-0 w-1.5 h-1.5 bg-white rounded-full pointer-events-none z-[9999]" />
    </>
  );
}

/* ─── Navbar ──────────────────────────────────────────────────────────────── */
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);
  return (
    <>
      <motion.nav
        className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 md:px-8 py-5 transition-all duration-500"
        style={scrolled ? { background: "rgba(0,0,0,0.85)", backdropFilter: "blur(24px)", borderBottom: "1px solid rgba(255,255,255,0.06)" } : {}}
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="PhantmOS Logo" className="w-10 h-10 object-contain" />
          <span className="text-white text-sm font-extrabold tracking-[0.22em] uppercase"
            style={{ fontFamily: "Unbounded, sans-serif" }}>PhantmOS</span>
        </div>

        <div className="hidden md:flex gap-8 text-white/45 text-sm tracking-wide">
          {[
            { label: "Capabilities", href: "#capabilities" },
            { label: "Workflow", href: "#workflow" },
            { label: "Intelligence", href: "#intelligence" },
            { label: "Outcomes", href: "#outcomes" },
          ].map(l => (
            <a 
              key={l.label} 
              href={l.href} 
              onClick={(e) => {
                e.preventDefault();
                document.querySelector(l.href)?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="hover:text-white transition-colors duration-300"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <a href="/auth" className="text-white/50 text-sm hover:text-white transition-colors duration-300 px-4 py-2">
            Sign In
          </a>
          <a href="/auth" className="glass glow-btn-glass flex items-center justify-center px-5 py-2.5 rounded-full text-white text-sm font-medium tracking-wide">
            Launch PhantmOS
          </a>
        </div>
        
        {/* Mobile toggle */}
        <button className="md:hidden text-white/70" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
        </button>
      </motion.nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black/95 flex flex-col items-center justify-center gap-8 md:hidden">
          {[
            { label: "Capabilities", href: "#capabilities" },
            { label: "Workflow", href: "#workflow" },
            { label: "Intelligence", href: "#intelligence" },
            { label: "Outcomes", href: "#outcomes" },
          ].map(l => (
            <a 
              key={l.label} 
              href={l.href} 
              onClick={(e) => {
                e.preventDefault();
                setMobileMenuOpen(false);
                document.querySelector(l.href)?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-white text-xl tracking-wide"
            >
              {l.label}
            </a>
          ))}
          <a href="/auth" className="text-white/50 text-xl mt-4">Sign In</a>
          <a href="/auth" className="mt-2 glass glow-btn-glass px-8 py-3 rounded-full text-white text-lg font-medium">Launch PhantmOS</a>
          
          <button className="absolute top-6 right-6 text-white/50" onClick={() => setMobileMenuOpen(false)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
          </button>
        </div>
      )}
    </>
  );
}


/* ─── AI Video Canvas (Full Screen) ─────────────────────────────────────── */
function HeroVideoCanvas({ scrollProgress }: { scrollProgress: any }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const frameCount = 150;

  // Add a spring to smooth out scroll jitter
  const smoothProgress = useSpring(scrollProgress, {
    stiffness: 80,
    damping: 25,
    restDelta: 0.001
  });

  // Preload images
  useEffect(() => {
    const loadedImages: HTMLImageElement[] = [];
    for (let i = 1; i <= frameCount; i++) {
      const img = new Image();
      const frameNum = i.toString().padStart(4, '0');
      img.src = `/hero-frames/frame_${frameNum}.webp`;
      loadedImages.push(img);
    }
    imagesRef.current = loadedImages;
  }, []);

  // Update canvas using requestAnimationFrame for 100% reliable rendering
  useEffect(() => {
    let rafId: number;
    let lastDrawnIndex = -1;

    const render = () => {
      // Get the absolute latest smoothed scroll progress directly
      const latest = smoothProgress.get() as any as number;
      const frameIndex = Math.min(frameCount - 1, Math.max(0, Math.floor(latest * frameCount)));
      const img = imagesRef.current[frameIndex];
      
      // If the image is loaded and we haven't drawn this frame yet, draw it!
      if (img && img.complete && frameIndex !== lastDrawnIndex) {
        console.log("Currently drawing frame:", frameIndex);
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
          // Initialize canvas size on first draw if needed
          if (canvas.width !== 1024) {
            canvas.width = 1024;
            canvas.height = 576;
          }
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          lastDrawnIndex = frameIndex;
        }
      }
      
      // Keep checking continuously. This guarantees the image will be drawn the millisecond it finishes loading.
      rafId = requestAnimationFrame(render);
    };
    
    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [smoothProgress]);

  return (
    <div className="absolute inset-0 z-0 w-full h-full overflow-hidden pointer-events-none">
      {/* Full opacity video for maximum visibility */}
      <canvas ref={canvasRef} className="w-full h-full object-cover opacity-100" />
      
      {/* Subtle left gradient just enough to make the left-aligned text readable, without washing out the rest of the video */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/30 to-transparent w-3/4" />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black opacity-60" />
    </div>
  );
}

/* ─── SVG Globe ───────────────────────────────────────────────────────────── */
const GLOBE_DOTS = [
  { cx: 155, cy: 118 }, { cx: 208, cy: 95  }, { cx: 285, cy: 128 },
  { cx: 325, cy: 172 }, { cx: 356, cy: 205 }, { cx: 182, cy: 198 },
  { cx: 132, cy: 182 }, { cx: 243, cy: 255 }, { cx: 305, cy: 263 },
  { cx: 178, cy: 282 }, { cx: 252, cy: 192 }, { cx: 315, cy: 138 },
  { cx: 224, cy: 148 }, { cx: 270, cy: 332 }, { cx: 142, cy: 255 },
];

function GlobeSVG() {
  return (
    <svg viewBox="0 0 480 480" className="w-full h-full">
      <defs>
        <radialGradient id="gBase" cx="50%" cy="44%" r="50%">
          <stop offset="0%" stopColor="#1a1a1a" />
          <stop offset="100%" stopColor="#000" />
        </radialGradient>
        <radialGradient id="gSheen" cx="38%" cy="36%" r="52%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.07)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <clipPath id="gc"><circle cx="240" cy="240" r="200" /></clipPath>
      </defs>

      <circle cx="240" cy="240" r="200" fill="url(#gBase)" />
      <circle cx="240" cy="240" r="200" fill="url(#gSheen)" />

      {/* Grid */}
      <g clipPath="url(#gc)" stroke="rgba(255,255,255,0.055)" strokeWidth="0.6" fill="none">
        {[-60, -30, 0, 30, 60].map(lat => {
          const r = Math.cos((lat * Math.PI) / 180) * 200;
          const cy2 = 240 + Math.sin((lat * Math.PI) / 180) * 200;
          return r > 0 ? <ellipse key={lat} cx="240" cy={cy2} rx={r} ry={r * 0.14} /> : null;
        })}
        {[0, 30, 60, 90, 120, 150].map(lon => (
          <ellipse key={lon} cx="240" cy="240"
            rx={Math.abs(Math.cos((lon * Math.PI) / 180)) * 200 + 0.1}
            ry="200" transform={`rotate(${lon},240,240)`} />
        ))}
      </g>

      {/* Rim */}
      <circle cx="240" cy="240" r="200" fill="none" stroke="rgba(255,255,255,0.11)" strokeWidth="1" />

      {/* Location dots */}
      {GLOBE_DOTS.map((d, i) => {
        const dur = `${2 + ((i * 0.37) % 1.8)}s`;
        return (
          <g key={i}>
            <circle cx={d.cx} cy={d.cy} r="2.5" fill="white">
              <animate attributeName="opacity" values="0.25;1;0.25" dur={dur} repeatCount="indefinite" />
            </circle>
            <circle cx={d.cx} cy={d.cy} r="7" fill="none" stroke="white" strokeWidth="0.6">
              <animate attributeName="r" values="4;13;4" dur={dur} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.5;0;0.5" dur={dur} repeatCount="indefinite" />
            </circle>
          </g>
        );
      })}

      {/* Connection arcs */}
      {[
        "M 155 118 Q 222 88 285 128",
        "M 208 95  Q 275 160 315 138",
        "M 325 172 Q 292 224 243 255",
        "M 182 198 Q 210 225 243 255",
      ].map((d, i) => (
        <path key={i} d={d} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="0.7"
          clipPath="url(#gc)">
          <animate attributeName="stroke-dasharray" values="0,260;130,130;260,0"
            dur={`${3.2 + i * 0.7}s`} repeatCount="indefinite" />
        </path>
      ))}
    </svg>
  );
}

/* ─── Data ────────────────────────────────────────────────────────────────── */
const AGENTS = [
  { icon: "D", name: "Discovery",  role: "Stage 1 — Harvesting",       desc: "Concurrently scrapes Remotive, Himalayas, Arbeitnow, and HN Who's Hiring. Queries the global job pool first — external APIs only fire when fewer than 5 local matches exist." },
  { icon: "R", name: "Ranking",    role: "Stage 2 — Scoring",          desc: "Scores every lead with a three-signal formula: 50% semantic similarity via Jina AI embeddings, 30% keyword overlap against your résumé skills, 20% title match. Assigns HOT / WARM / COLD / REJECT bands." },
  { icon: "Re", name: "Research",  role: "OSINT Intelligence",          desc: "Fetches real-time DuckDuckGo headlines to overcome the LLM's knowledge cutoff, then calls Groq to produce a company stability score (0–100), tech stack, and funding timeline." },
  { icon: "T", name: "Tailor",     role: "Stage 3 — LLM Synthesis",    desc: "Runs a Groq → Gemini → HuggingFace waterfall with 3 retries per provider. HOT leads get a full résumé rewrite; WARM leads get a targeted skills highlight. All outputs are JSON-validated before saving." },
  { icon: "A", name: "ATS",        role: "Quality Evaluation",         desc: "Scores your tailored résumé against the job description (0–100 ATS compatibility), detects keyword gaps, and generates a role-specific interview prep cheat sheet with historical questions by stage." },
  { icon: "Ap", name: "Apply",     role: "Stage 4+5 — Delivery",       desc: "Generates a pixel-perfect PDF via RenderCV (Typst backend) and uploads it to Supabase Storage. Sends interactive job cards to Telegram and fires cold emails via Gmail SMTP with the PDF attached." },
  { icon: "F", name: "Feedback",   role: "Learning Loop",              desc: "Records every dismissal signal (too junior, wrong stack, bad company) and adjusts scoring weights per user — so the pipeline gets sharper with every interaction." },
  { icon: "An", name: "Analytics", role: "Pipeline Metrics",           desc: "Aggregates HOT/WARM/COLD counts, status distributions, and score histograms via a high-performance Supabase RPC. Fires a daily digest to Telegram every morning at 09:00 IST." },
];

const STEPS = [
  { n: "01", title: "Upload Résumé",        desc: "Upload a PDF or paste your résumé JSON. Groq (Llama-3.1) parses it instantly into a structured profile. Your master embedding is computed once and cached in Supabase." },
  { n: "02", title: "Global Harvest",       desc: "The global harvester runs across Remotive, Himalayas, Arbeitnow, and HN Who's Hiring in parallel. BM25 pre-filter drops irrelevant results before they ever touch the DB." },
  { n: "03", title: "Semantic Scoring",     desc: "Jina AI embeddings compute cosine similarity between your résumé and every job description. Weighted 50% semantic + 30% keyword + 20% title match → final 0–100 score." },
  { n: "04", title: "LLM Tailoring",        desc: "HOT leads (≥ your threshold + halfway to 100) get a full résumé rewrite. WARM leads get targeted highlights. All outputs pass a JSON structure validator before being saved." },
  { n: "05", title: "PDF Generation",       desc: "RenderCV compiles your tailored résumé JSON into a Typst-rendered PDF. Uploaded to Supabase Storage with a permanent public URL. Theme is per-user configurable." },
  { n: "06", title: "ATS Evaluation",       desc: "An ATS agent scores your tailored résumé (0–100), surfaces keyword gaps, and generates an interview prep playbook — cultural values, historical technical questions, recent launches." },
  { n: "07", title: "Telegram Delivery",    desc: "Interactive job cards land in your Telegram DMs. Each card shows the score band, company, role, and a direct apply link. Notifications fire only above your custom threshold." },
  { n: "08", title: "Cold Email Dispatch",  desc: "The pipeline hunts for a company email via OSINT, drafts a personalized follow-up via Groq, and dispatches via Gmail SMTP — PDF résumé attached." },
];

const TESTIMONIALS = [
  { quote: "I uploaded my PDF on Sunday. By Monday morning my Telegram had 12 job cards — each with a tailored résumé already generated. HOT leads had personalized cover emails queued. I hadn't touched a keyboard.", name: "Pipeline Overview",  role: "End-to-End Automation",  company: "Discovery → Delivery",    stat: "0 manual steps" },
  { quote: "The scoring model is brutally honest. BM25 pre-filters noise before it reaches the DB, then Jina embeddings rank what's left by true semantic fit — not keyword stuffing. REJECTs never waste your time.", name: "Ranking Engine",    role: "3-Signal Composite Score", company: "Semantic + Keyword + Title", stat: "50 / 30 / 20%" },
  { quote: "Groq fails? Gemini picks it up. Gemini rate-limits? HuggingFace steps in. Every output is JSON-validated before saving. One bad API call has never once stopped a pipeline run.",                           name: "LLM Waterfall",    role: "Fault-Tolerant Synthesis", company: "Groq → Gemini → HF",       stat: "3-provider chain" },
];

const FEATURES = [
  { title: "Global Job Pool",           desc: "A shared global_jobs table is populated once across all users. The per-user pipeline queries it locally first — external API calls only fire when fewer than 5 fresh matches exist. Zero redundant scraping." },
  { title: "Encrypted BYOK Keys",       desc: "Bring your own Groq, Gemini, or HuggingFace API keys. They are encrypted with Fernet (AES-128) before storage — a SHA-256 digest of your Supabase key is the symmetric seed. Only \"***\" is ever sent to your browser." },
  { title: "RenderCV PDF Engine",       desc: "Tailored résumé JSON is compiled into a polished PDF via RenderCV's Typst backend. Theme is per-user configurable (sb2nov, classic, engineeringresumes). PDFs land in Supabase Storage with permanent public URLs." },
  { title: "Telegram + Gmail Delivery", desc: "HOT/WARM leads trigger Telegram job cards above your custom score threshold. The Phantm Writer endpoint drafts a personalized follow-up email, hunts the recruiter's address via OSINT, and dispatches via Gmail SMTP with the PDF attached." },
];

/* ─── App ─────────────────────────────────────────────────────────────────── */
function App() {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [activeStep, setActiveStep] = useState(0);
  const heroRef   = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end end"] });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  useEffect(() => {
    const h = (e: MouseEvent) => setMouse({
      x: e.clientX / window.innerWidth  - 0.5,
      y: e.clientY / window.innerHeight - 0.5,
    });
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setActiveStep(s => (s + 1) % STEPS.length), 2800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bg-black text-white min-h-screen overflow-clip" style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}>
      <GlobalStyles />
      <Nav />

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative" style={{ height: "300vh" }}>
        <div className="sticky top-0 h-screen w-full flex items-center overflow-hidden px-6 pt-24">
        
        {/* Full Screen Background Video Canvas */}
        <HeroVideoCanvas scrollProgress={scrollYProgress} />

        {/* Existing background elements (z-index between canvas and text) */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <ParticleCanvas count={100} />

          {/* Scan line */}
          <div className="absolute inset-0 overflow-hidden">
            <div style={{
              position: "absolute", width: "100%", height: "1px",
              background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.09) 50%, transparent 100%)",
              animation: "scan-down 9s linear infinite",
            }} />
          </div>

          {/* Central glow (disabled so it doesn't wash out the video) */}
          <div className="hidden" />
        </div>

        {/* We keep the grid but leave the right column empty so the text stays aligned left */}
        <div className="relative z-10 w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left */}
          <div>
            <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.7 }} className="mb-7">
              <span className="glass inline-block text-white/40 text-[10px] tracking-[0.32em] uppercase px-4 py-1.5 rounded-full"
                style={{ fontFamily: "JetBrains Mono, monospace" }}>
                Autonomous AI OS — v3.0
              </span>
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.32, duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="heading-gradient text-[clamp(2.5rem,4.5vw,5.5rem)] font-black leading-[1.05] tracking-tight mb-8 whitespace-nowrap"
              style={{ fontFamily: "Unbounded, sans-serif" }}>
              PHANTMOS
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.52, duration: 0.85 }}
              className="text-white/45 text-[1.05rem] leading-[1.75] max-w-[480px] mb-10">
              Your autonomous AI workforce that discovers opportunities, analyzes your profile, tailors your resume, and applies to jobs automatically while you focus on building your future.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.8 }} className="flex flex-wrap gap-4 mb-14">
              <a href="/auth" className="glow-btn-white relative inline-flex items-center justify-center px-8 py-4 bg-white text-black font-semibold text-sm tracking-wide rounded-full transition-all duration-300">
                Launch PhantmOS
              </a>
              <a href="/dashboard" className="glow-btn-glass glass flex items-center gap-2 px-8 py-4 text-white font-medium text-sm tracking-wide rounded-full group transition-all duration-300">
                View Dashboard
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform duration-300" />
              </a>
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: 1.05, duration: 0.8 }}
              className="flex gap-9 pt-8" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              {[
                { v: "4",     l: "Live Job Sources" },
                { v: "3-tier", l: "LLM Waterfall" },
                { v: "HOT→PDF", l: "Fully Automated" },
              ].map(({ v, l }) => (
                <div key={l}>
                  <div className="heading-gradient text-2xl font-black" style={{ fontFamily: "Unbounded, sans-serif" }}>{v}</div>
                  <div className="text-white/35 text-xs tracking-wide mt-1">{l}</div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right — Now empty to let the background shine through */}
          <div className="hidden lg:block w-full h-full pointer-events-none" />
        </div>

        {/* Scroll cue */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10">
          <span className="text-white/25 text-[10px] tracking-[0.28em]" style={{ fontFamily: "JetBrains Mono, monospace" }}>SCROLL</span>
          <div className="w-px h-10" style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.3), transparent)", animation: "float-b 2.2s ease-in-out infinite" }} />
        </motion.div>
        
        </div>
      </section>

      {/* ── AI WORKFORCE ─────────────────────────────────────────────────────── */}
      <section className="py-36 px-6">
        <div className="max-w-7xl mx-auto">
          <RevealBlock>
            <div className="text-white/30 text-[10px] tracking-[0.32em] uppercase mb-5"
              style={{ fontFamily: "JetBrains Mono, monospace" }}>01 — AI Workforce</div>
            <h2 className="heading-gradient text-[clamp(2.8rem,6vw,5.5rem)] font-black tracking-tight mb-5"
              style={{ fontFamily: "Unbounded, sans-serif" }}>
              Eight Agents.<br />One Pipeline.
            </h2>
            <p className="text-white/38 text-base leading-relaxed max-w-lg mb-16">
              Each agent owns a single stage and exposes a clean interface. The orchestrator coordinates them — it contains zero business logic itself.
            </p>
          </RevealBlock>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {AGENTS.map((a, i) => (
              <RevealBlock key={a.name} delay={i * 0.09}>
                <div className="glass h-full rounded-2xl p-7 group transition-all duration-400">
                  {/* Icon */}
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", fontFamily: "Unbounded, sans-serif", fontSize: "13px", fontWeight: 900, color: "rgba(255,255,255,0.55)" }}>
                    {a.icon}
                  </div>
                  <div className="text-white/28 text-[10px] tracking-[0.2em] uppercase mb-1.5"
                    style={{ fontFamily: "JetBrains Mono, monospace" }}>{a.role}</div>
                  <h3 className="text-white font-bold text-xl mb-3">{a.name}</h3>
                  <p className="text-white/38 text-sm leading-relaxed">{a.desc}</p>
                  <div className="mt-5 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-white/55"
                      style={{ animation: `glow-pulse 2.2s ease-in-out infinite`, animationDelay: `${i * 0.38}s` }} />
                    <span className="text-white/28 text-[9px] tracking-widest" style={{ fontFamily: "JetBrains Mono, monospace" }}>ACTIVE</span>
                  </div>
                </div>
              </RevealBlock>
            ))}
          </div>
        </div>
      </section>

      {/* ── WORKFLOW ─────────────────────────────────────────────────────────── */}
      <section id="workflow" className="py-36 px-6">
        <div className="max-w-7xl mx-auto">
          <RevealBlock>
            <div className="text-white/30 text-[10px] tracking-[0.32em] uppercase mb-5"
              style={{ fontFamily: "JetBrains Mono, monospace" }}>02 — PhantmOS Sequence</div>
            <h2 className="heading-gradient text-[clamp(2.8rem,6vw,5.5rem)] font-black tracking-tight mb-16"
              style={{ fontFamily: "Unbounded, sans-serif" }}>
              How It<br />Executes.
            </h2>
          </RevealBlock>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {STEPS.map((s, i) => (
              <RevealBlock key={s.n} delay={i * 0.065}>
                <div className={`glass rounded-2xl p-5 h-full transition-all duration-600 ${activeStep === i ? "bg-white/[0.055] border-white/20" : ""}`}>
                  <div className="text-white/22 text-[10px] tracking-widest mb-3"
                    style={{ fontFamily: "JetBrains Mono, monospace" }}>{s.n}</div>
                  <h4 className="text-white font-semibold text-sm mb-2 leading-snug">{s.title}</h4>
                  <p className="text-white/35 text-xs leading-relaxed mb-4">{s.desc}</p>
                  <div className="step-bar">
                    <div className="step-bar-fill"
                      style={{ width: activeStep >= i ? "100%" : "0%" }} />
                  </div>
                </div>
              </RevealBlock>
            ))}
          </div>
        </div>
      </section>

      {/* ── GLOBE ────────────────────────────────────────────────────────────── */}
      <section id="intelligence" className="py-36 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <RevealBlock>
            <div className="text-white/30 text-[10px] tracking-[0.32em] uppercase mb-5"
              style={{ fontFamily: "JetBrains Mono, monospace" }}>03 — Global Intelligence</div>
            <h2 className="heading-gradient text-[clamp(2.8rem,6vw,5rem)] font-black tracking-tight mb-6"
              style={{ fontFamily: "Unbounded, sans-serif" }}>
              Watching<br />Every Market.
            </h2>
            <p className="text-white/38 text-base leading-relaxed mb-10 max-w-md">
              PhantmOS monitors job markets across every major city and remote-first company, ensuring zero opportunity goes undetected.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { v: "4",      l: "Live Sources" },
                { v: "BM25",   l: "Pre-Filter Engine" },
                { v: "MD5",    l: "Dedup Strategy" },
                { v: "Global", l: "Shared Job Pool" },
              ].map(({ v, l }) => (
                <div key={l} className="glass rounded-xl p-4">
                  <div className="text-white text-2xl font-black mb-1" style={{ fontFamily: "Unbounded, sans-serif" }}>{v}</div>
                  <div className="text-white/38 text-xs">{l}</div>
                </div>
              ))}
            </div>
          </RevealBlock>

          <RevealBlock delay={0.15}>
            <div className="float-a relative w-full max-w-[480px] mx-auto">
              <div className="absolute inset-0 rounded-full pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(255,255,255,0.055) 0%, transparent 68%)", filter: "blur(50px)" }} />
              <GlobeSVG />
            </div>
          </RevealBlock>
        </div>
      </section>

      {/* ── DASHBOARD ────────────────────────────────────────────────────────── */}
      <section className="py-36 px-6">
        <div className="max-w-7xl mx-auto">
          <RevealBlock className="text-center mb-16">
            <div className="text-white/30 text-[10px] tracking-[0.32em] uppercase mb-5"
              style={{ fontFamily: "JetBrains Mono, monospace" }}>04 — Command Center</div>
            <h2 className="heading-gradient text-[clamp(2.8rem,6vw,5.5rem)] font-black tracking-tight"
              style={{ fontFamily: "Unbounded, sans-serif" }}>Full Visibility.</h2>
          </RevealBlock>

          <RevealBlock delay={0.12}>
            <div className="float-b relative max-w-5xl mx-auto">
              {/* Glow */}
              <div className="absolute -inset-12 rounded-3xl pointer-events-none"
                style={{ background: "radial-gradient(ellipse, rgba(255,255,255,0.055) 0%, transparent 70%)", filter: "blur(24px)" }} />

              {/* Laptop screen */}
              <div className="relative rounded-2xl overflow-hidden"
                style={{ background: "rgba(8,8,8,0.92)", border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 50px 140px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.06)" }}>

                {/* Toolbar */}
                <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex gap-1.5">{[0,1,2].map(j => <div key={j} className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(255,255,255,0.09)" }} />)}</div>
                  <div className="flex-1 flex justify-center">
                    <div className="glass px-4 py-1 rounded text-white/28 text-[10px]" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                      phantmos.ai/dashboard
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 grid grid-cols-12 gap-3 min-h-[380px]">
                  {/* Sidebar */}
                  <div className="col-span-2 space-y-0.5">
                    {["Overview", "Applications", "Matches", "Agents", "Analytics"].map((item, idx) => (
                      <div key={item} className={`text-[10px] px-2.5 py-2 rounded-lg transition-colors ${idx === 0 ? "text-white/70" : "text-white/28"}`}
                        style={{ background: idx === 0 ? "rgba(255,255,255,0.07)" : "transparent", fontFamily: "JetBrains Mono, monospace" }}>
                        {item}
                      </div>
                    ))}
                  </div>

                  {/* Main */}
                  <div className="col-span-10 grid grid-cols-3 gap-3">
                    {/* KPI cards */}
                    {[
                      { l: "HOT Leads",   v: "HOT",  s: "≥ threshold + 50% gap" },
                      { l: "WARM Leads",  v: "WARM", s: "≥ user threshold (60)" },
                      { l: "Credits Left", v: "870", s: "30 refilled / month" },
                    ].map(({ l, v, s }) => (
                      <div key={l} className="glass rounded-xl p-4">
                        <div className="text-white/28 text-[9px] tracking-widest mb-2" style={{ fontFamily: "JetBrains Mono, monospace" }}>{l}</div>
                        <div className="text-white text-2xl font-black mb-1" style={{ fontFamily: "Unbounded, sans-serif" }}>{v}</div>
                        <div className="text-white/38 text-[9px]">{s}</div>
                      </div>
                    ))}

                    {/* Bar chart */}
                    <div className="col-span-2 glass rounded-xl p-4">
                      <div className="text-white/28 text-[9px] tracking-widest mb-3" style={{ fontFamily: "JetBrains Mono, monospace" }}>APPLICATION PIPELINE</div>
                      <div className="flex items-end gap-1 h-20">
                        {[42,68,48,82,57,92,73,87,62,96,78,89,74,94,68,85].map((h, i) => (
                          <div key={i} className="flex-1 rounded-[2px] transition-all duration-300"
                            style={{ height: `${h}%`, background: `rgba(255,255,255,${0.06 + (h / 100) * 0.28})` }} />
                        ))}
                      </div>
                    </div>

                    {/* Resume score */}
                    <div className="glass rounded-xl p-4 flex flex-col items-center justify-center gap-1">
                      <div className="text-white/28 text-[9px] tracking-widest" style={{ fontFamily: "JetBrains Mono, monospace" }}>RESUME SCORE</div>
                      <div className="text-white text-4xl font-black" style={{ fontFamily: "Unbounded, sans-serif" }}>94</div>
                      <div className="text-white/30 text-[9px]">/ 100</div>
                    </div>

                    {/* Recent */}
                    <div className="col-span-3 glass rounded-xl p-4">
                      <div className="text-white/28 text-[9px] tracking-widest mb-3" style={{ fontFamily: "JetBrains Mono, monospace" }}>RECENT APPLICATIONS</div>
                      <div className="space-y-2">
                        {[
                          { co: "Remotive",  role: "ML Engineer · Score 91",    st: "HOT",       ago: "2h" },
                          { co: "Himalayas", role: "AI Engineer · Score 74",     st: "WARM",      ago: "4h" },
                          { co: "Arbeitnow", role: "Data Scientist · Score 38",  st: "REJECTED",  ago: "6h" },
                        ].map(({ co, role, st, ago }) => (
                          <div key={co} className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                            <div className="flex items-center gap-2.5">
                              <div className="w-6 h-6 rounded glass flex items-center justify-center text-[9px] text-white/45"
                                style={{ fontFamily: "JetBrains Mono, monospace" }}>{co[0]}</div>
                              <div>
                                <div className="text-white/65 text-[10px] font-semibold">{co}</div>
                                <div className="text-white/30 text-[9px]">{role}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`text-[9px] px-2 py-0.5 rounded-full ${st === "HOT" ? "text-white/90" : st === "WARM" ? "text-white/65" : "text-white/25"}`}
                                style={{ background: st === "HOT" ? "rgba(255,255,255,0.16)" : st === "WARM" ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                {st}
                              </span>
                              <span className="text-white/22 text-[9px]">{ago} ago</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Base */}
              <div className="h-3.5 mx-10 rounded-b-xl"
                style={{ background: "rgba(14,14,14,0.95)", border: "1px solid rgba(255,255,255,0.07)", borderTop: "none" }} />
            </div>
          </RevealBlock>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────────────── */}
      <section id="capabilities" className="py-36 px-6">
        <div className="max-w-7xl mx-auto">
          <RevealBlock>
            <div className="text-white/30 text-[10px] tracking-[0.32em] uppercase mb-5"
              style={{ fontFamily: "JetBrains Mono, monospace" }}>05 — Capabilities</div>
            <h2 className="heading-gradient text-[clamp(2.8rem,6vw,5.5rem)] font-black tracking-tight mb-16"
              style={{ fontFamily: "Unbounded, sans-serif" }}>Built Different.</h2>
          </RevealBlock>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {FEATURES.map((f, i) => (
              <RevealBlock key={f.title} delay={i * 0.1}>
                <div className="glass rounded-2xl p-9 h-full group transition-all duration-400">
                  <div className="flex items-start justify-between mb-7">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white/35 text-[10px]"
                      style={{ border: "1px solid rgba(255,255,255,0.1)", fontFamily: "JetBrains Mono, monospace" }}>
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <ChevronRight size={15} className="text-white/18 group-hover:text-white/55 group-hover:translate-x-1 transition-all duration-300" />
                  </div>
                  <h3 className="text-white font-bold text-2xl mb-3 leading-tight">{f.title}</h3>
                  <p className="text-white/38 text-sm leading-relaxed">{f.desc}</p>
                </div>
              </RevealBlock>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────────────────────── */}
      <section id="outcomes" className="py-36 px-6">
        <div className="max-w-7xl mx-auto">
          <RevealBlock>
            <div className="text-white/30 text-[10px] tracking-[0.32em] uppercase mb-5"
              style={{ fontFamily: "JetBrains Mono, monospace" }}>06 — Outcomes</div>
            <h2 className="heading-gradient text-[clamp(2.8rem,6vw,5.5rem)] font-black tracking-tight mb-16"
              style={{ fontFamily: "Unbounded, sans-serif" }}>Results Speak.</h2>
          </RevealBlock>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TESTIMONIALS.map((t, i) => (
              <RevealBlock key={t.name} delay={i * 0.13}>
                <div className="glass rounded-2xl p-7 flex flex-col h-full">
                  <div className="text-white/12 text-6xl leading-none mb-4 font-black" style={{ fontFamily: "Unbounded, sans-serif" }}>"</div>
                  <p className="text-white/55 text-sm leading-relaxed flex-1 mb-6 italic">{t.quote}</p>
                  <div className="flex items-end justify-between" style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "1.25rem" }}>
                    <div>
                      <div className="text-white font-semibold text-sm">{t.name}</div>
                      <div className="text-white/32 text-xs mt-0.5">{t.role}</div>
                      <div className="text-white/45 text-xs mt-0.5">{t.company}</div>
                    </div>
                    <div className="glass-strong rounded-lg px-3.5 py-2 text-center">
                      <div className="text-white/65 text-[10px] font-bold" style={{ fontFamily: "JetBrains Mono, monospace" }}>{t.stat}</div>
                    </div>
                  </div>
                </div>
              </RevealBlock>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <section className="relative py-44 px-6 overflow-hidden">
        <ParticleCanvas count={65} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 68%)" }} />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <RevealBlock>
            <div className="text-white/30 text-[10px] tracking-[0.32em] uppercase mb-7"
              style={{ fontFamily: "JetBrains Mono, monospace" }}>Initialize PhantmOS</div>
            <h2 className="heading-gradient text-[clamp(3rem,8vw,7rem)] font-black tracking-tight leading-[0.9] mb-8"
              style={{ fontFamily: "Unbounded, sans-serif" }}>
              Let AI Handle<br />Your Job Search.
            </h2>
            <p className="text-white/40 text-lg mb-12 max-w-lg mx-auto leading-relaxed">
              Upload your résumé. Set your target roles. PhantmOS runs the rest — discovery, scoring, tailoring, PDFs, and delivery — fully on autopilot.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <a href="/auth" className="glow-btn-white inline-flex items-center justify-center px-11 py-5 bg-white text-black font-semibold text-sm tracking-wide rounded-full transition-all duration-300">
                Start Free
              </a>
              <a href="/dashboard" className="glow-btn-glass glass flex items-center justify-center gap-2 px-11 py-5 text-white font-medium text-sm tracking-wide rounded-full group transition-all duration-300">
                Launch Dashboard
                <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform duration-300" />
              </a>
            </div>
          </RevealBlock>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer className="px-6 py-10" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-7">
          <div className="flex items-center gap-2.5">
            <div className="relative w-5 h-5">
              <div className="absolute inset-0 rounded-full border border-white/38" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/55" />
            </div>
            <span className="text-white/50 font-extrabold tracking-[0.22em] text-[11px] uppercase"
              style={{ fontFamily: "Unbounded, sans-serif" }}>PhantmOS</span>
          </div>

          <div className="flex flex-wrap gap-6 text-white/28 text-xs">
            {([
              { label: "Security",      href: "#capabilities" },
              { label: "API",           href: "/dashboard" },
              { label: "Documentation", href: "https://github.com" },
              { label: "Settings",      href: "/settings" },
              { label: "Applications",  href: "/applications" },
              { label: "Pipeline",      href: "/job-discovery" },
            ] as { label: string; href: string }[]).map(item => (
              item.href.startsWith("/") && !item.href.startsWith("//")
                ? <Link key={item.label} to={item.href as any} className="hover:text-white/55 transition-colors duration-300">{item.label}</Link>
                : <a key={item.label} href={item.href} className="hover:text-white/55 transition-colors duration-300">{item.label}</a>
            ))}
          </div>

          <div className="text-white/18 text-[10px]" style={{ fontFamily: "JetBrains Mono, monospace" }}>
            © 2026 PhantmOS. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─── Reveal wrapper ──────────────────────────────────────────────────────── */
function RevealBlock({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div ref={ref} className={className}
      initial={{ opacity: 0, y: 38 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </motion.div>
  );
}

export const Route = createFileRoute("/")({
  component: App,
});
