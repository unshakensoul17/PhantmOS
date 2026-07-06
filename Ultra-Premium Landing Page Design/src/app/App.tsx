import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useInView, useScroll, useTransform } from "motion/react";
import { ArrowRight, ChevronRight } from "lucide-react";

/* ─── Global keyframes + utility classes ─────────────────────────────────── */
function GlobalStyles() {
  return (
    <style>{`
      * { cursor: none !important; }
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
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);
  return (
    <motion.nav
      className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-8 py-5 transition-all duration-500"
      style={scrolled ? { background: "rgba(0,0,0,0.85)", backdropFilter: "blur(24px)", borderBottom: "1px solid rgba(255,255,255,0.06)" } : {}}
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div className="relative w-6 h-6">
          <div className="absolute inset-0 rounded-full border border-white/50" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white"
            style={{ animation: "glow-pulse 2.4s ease-in-out infinite" }} />
        </div>
        <span className="text-white text-sm font-extrabold tracking-[0.22em] uppercase"
          style={{ fontFamily: "Unbounded, sans-serif" }}>Ghost Protocol</span>
      </div>

      {/* Links */}
      <div className="hidden md:flex gap-8 text-white/45 text-sm tracking-wide">
        {["Capabilities", "Workflow", "Intelligence", "Pricing"].map(l => (
          <a key={l} href="#" className="hover:text-white transition-colors duration-300">{l}</a>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button className="text-white/50 text-sm hover:text-white transition-colors duration-300 px-4 py-2">
          Sign In
        </button>
        <button className="glass glow-btn-glass px-5 py-2.5 rounded-full text-white text-sm font-medium tracking-wide">
          Launch Protocol
        </button>
      </div>
    </motion.nav>
  );
}

/* ─── AI Core ─────────────────────────────────────────────────────────────── */
function AICore({ mx, my }: { mx: number; my: number }) {
  return (
    <div className="relative w-[540px] h-[540px] select-none"
      style={{
        perspective: "1100px",
        transformStyle: "preserve-3d",
        transform: `rotateX(${my * 9}deg) rotateY(${mx * 9}deg)`,
        transition: "transform 0.18s cubic-bezier(0.23,1,0.32,1)",
      }}>

      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] h-[440px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 68%)", filter: "blur(4px)" }} />

      {/* Ring 1 — equatorial, CW */}
      <div className="absolute ring-1" style={{
        top: "50%", left: "50%",
        width: "390px", height: "390px", borderRadius: "50%",
        border: "1px solid rgba(255,255,255,0.18)",
      }} />
      {/* Ring 2 — outer, CCW */}
      <div className="absolute ring-2" style={{
        top: "50%", left: "50%",
        width: "475px", height: "475px", borderRadius: "50%",
        border: "1px solid rgba(255,255,255,0.07)",
      }} />
      {/* Ring 3 — tilted */}
      <div className="absolute ring-3" style={{
        top: "50%", left: "50%",
        width: "310px", height: "310px", borderRadius: "50%",
        border: "1px solid rgba(255,255,255,0.13)",
      }} />

      {/* Equatorial orbit nodes */}
      {(["node-eq-0", "node-eq-1", "node-eq-2"] as const).map((cls, i) => (
        <div key={cls} className={`absolute ${cls}`} style={{ top: "50%", left: "50%" }}>
          <div style={{
            position: "absolute", width: "9px", height: "9px", borderRadius: "50%",
            background: "white", transform: "translate(-50%,-50%)",
            boxShadow: "0 0 12px rgba(255,255,255,0.9), 0 0 24px rgba(255,255,255,0.4)",
          }} />
        </div>
      ))}

      {/* Tilted orbit nodes */}
      {(["node-tl-0", "node-tl-1", "node-tl-2"] as const).map((cls) => (
        <div key={cls} className={`absolute ${cls}`} style={{ top: "50%", left: "50%" }}>
          <div style={{
            position: "absolute", width: "6px", height: "6px", borderRadius: "50%",
            background: "rgba(255,255,255,0.65)", transform: "translate(-50%,-50%)",
            boxShadow: "0 0 8px rgba(255,255,255,0.6)",
          }} />
        </div>
      ))}

      {/* Central orb */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120px] h-[120px] rounded-full"
        style={{
          background: "radial-gradient(circle at 36% 32%, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.38) 38%, rgba(255,255,255,0.06) 68%, transparent 100%)",
          boxShadow: "0 0 50px rgba(255,255,255,0.22), 0 0 100px rgba(255,255,255,0.09), 0 0 200px rgba(255,255,255,0.04)",
        }} />
      {/* Glass shell overlay */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[136px] h-[136px] rounded-full"
        style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,0.18)" }} />

      {/* SVG connection lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.28 }}>
        {[
          [270, 270, 400, 155], [270, 270, 425, 315], [270, 270, 135, 160],
          [270, 270, 115, 330], [270, 270, 278, 78],  [270, 270, 262, 455],
        ].map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="rgba(255,255,255,0.6)" strokeWidth="0.5"
            strokeDasharray="4 8"
            style={{ animation: `dash-flow ${6 + i}s linear infinite`, animationDelay: `${-i * 1.2}s` }} />
        ))}
      </svg>

      {/* Floating agent label chips */}
      {[
        { x: "74%", y: "12%", label: "Scout",   delay: "0s" },
        { x: "84%", y: "50%", label: "Tailor",  delay: "0.6s" },
        { x: "68%", y: "86%", label: "Apply",   delay: "1.2s" },
        { x: "10%", y: "82%", label: "Track",   delay: "1.8s" },
        { x: "4%",  y: "44%", label: "Match",   delay: "2.4s" },
        { x: "16%", y: "10%", label: "Analyze", delay: "3s" },
      ].map(({ x, y, label, delay }) => (
        <div key={label} className="absolute glass"
          style={{
            left: x, top: y, padding: "5px 11px", borderRadius: "20px",
            fontSize: "10px", letterSpacing: "0.14em", color: "rgba(255,255,255,0.65)",
            fontFamily: "JetBrains Mono, monospace",
            animation: `float-b 3.5s ease-in-out infinite`,
            animationDelay: delay,
          }}>
          {label}
        </div>
      ))}
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
  { icon: "S", name: "Scout",   role: "Opportunity Discovery",  desc: "Scans 200+ job boards, LinkedIn, and company career pages in real-time, surfacing positions before they saturate." },
  { icon: "A", name: "Analyst", role: "Profile Intelligence",   desc: "Performs deep semantic analysis of your experience, skills, and trajectory to build your precise AI profile." },
  { icon: "T", name: "Tailor",  role: "Resume Optimization",    desc: "Dynamically rewrites your resume for each role using ATS algorithms and proven hiring-manager psychology." },
  { icon: "W", name: "Writer",  role: "Cover Letter Engine",    desc: "Crafts personalized cover letters that speak directly to each company's culture and stated job requirements." },
  { icon: "P", name: "Pilot",   role: "Auto Application",       desc: "Executes applications autonomously — completing forms, uploading documents, following up at optimal windows." },
  { icon: "O", name: "Oracle",  role: "Decision Intelligence",  desc: "Evaluates fit scores, salary benchmarks, and culture signals to prioritize your highest-potential opportunities." },
];

const STEPS = [
  { n: "01", title: "Profile Upload",       desc: "Upload your resume and connect LinkedIn. AI extracts your complete professional DNA in seconds." },
  { n: "02", title: "Job Discovery",        desc: "Scout Agent actively hunts across 200+ sources, 24/7, matching against your exact profile." },
  { n: "03", title: "Semantic Matching",    desc: "Deep NLP analysis of job descriptions vs your experience — far beyond keyword matching." },
  { n: "04", title: "Resume Optimization",  desc: "Dynamic tailoring for each role, beating ATS filters and impressing human reviewers." },
  { n: "05", title: "Cover Letters",        desc: "Personalized, compelling letters that read like you spent hours crafting each one." },
  { n: "06", title: "Decision Engine",      desc: "Scores each role by fit, salary, growth potential, and your stated career goals." },
  { n: "07", title: "Auto Applications",    desc: "Pilot Agent submits to approved roles at optimal times using your saved preferences." },
  { n: "08", title: "Interview Tracking",   desc: "Full pipeline visibility: responses, interviews, offers — one command center." },
];

const TESTIMONIALS = [
  { quote: "Ghost Protocol found and applied to 340 positions in my first month. I received 47 responses and landed 3 offers. I spent zero hours on applications.", name: "Marcus Chen",  role: "Senior ML Engineer", company: "Hired at Stripe",  stat: "340 applied" },
  { quote: "I was skeptical. Then I watched it rewrite my resume 60 different ways overnight, each tailored perfectly. I had a call from Google the next morning.", name: "Priya Sharma", role: "Product Designer",   company: "Hired at Google",  stat: "60 versions" },
  { quote: "This is what AI was supposed to do. Not chat — act. Ghost Protocol turned my 6-month job search into a 3-week process.",                               name: "James Okafor", role: "Financial Analyst",  company: "Hired at Citadel", stat: "3 weeks" },
];

const FEATURES = [
  { title: "Zero-Touch Applications",  desc: "From discovery to submission — fully automated. You approve, Ghost Protocol executes with surgical precision." },
  { title: "ATS Invisibility",          desc: "Every resume is engineered to pass applicant tracking systems with precision keyword architecture." },
  { title: "24/7 Active Scanning",      desc: "Your AI workforce never sleeps. Jobs are discovered and analyzed around the clock across every time zone." },
  { title: "Semantic Intelligence",     desc: "Not keyword matching — deep semantic understanding of your skills vs job requirements creates genuinely relevant applications." },
];

/* ─── App ─────────────────────────────────────────────────────────────────── */
export default function App() {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [activeStep, setActiveStep] = useState(0);
  const heroRef   = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY     = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
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
    <div className="bg-black text-white min-h-screen overflow-x-hidden" style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}>
      <GlobalStyles />
      <Cursor />
      <Nav />

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <motion.section ref={heroRef} className="relative min-h-screen flex items-center overflow-hidden px-6 pt-24"
        style={{ y: heroY }}>
        <ParticleCanvas count={100} />

        {/* Scan line */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div style={{
            position: "absolute", width: "100%", height: "1px",
            background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.09) 50%, transparent 100%)",
            animation: "scan-down 9s linear infinite",
          }} />
        </div>

        {/* Central glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(255,255,255,0.035) 0%, transparent 68%)" }} />

        <div className="relative z-10 w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left */}
          <div>
            <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.7 }} className="mb-7">
              <span className="glass inline-block text-white/40 text-[10px] tracking-[0.32em] uppercase px-4 py-1.5 rounded-full"
                style={{ fontFamily: "JetBrains Mono, monospace" }}>
                Autonomous AI OS — v2.0
              </span>
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.32, duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="heading-gradient text-[clamp(4rem,10vw,8.5rem)] font-black leading-[0.88] tracking-tight mb-8"
              style={{ fontFamily: "Unbounded, sans-serif" }}>
              GHOST<br />PROTOCOL
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.52, duration: 0.85 }}
              className="text-white/45 text-[1.05rem] leading-[1.75] max-w-[480px] mb-10">
              Your autonomous AI workforce that discovers opportunities, analyzes your profile, tailors your resume, and applies to jobs automatically while you focus on building your future.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.8 }} className="flex flex-wrap gap-4 mb-14">
              <button className="glow-btn-white relative px-8 py-4 bg-white text-black font-semibold text-sm tracking-wide rounded-full transition-all duration-300">
                Launch Protocol
              </button>
              <button className="glow-btn-glass glass flex items-center gap-2 px-8 py-4 text-white font-medium text-sm tracking-wide rounded-full group transition-all duration-300">
                View Demo
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform duration-300" />
              </button>
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: 1.05, duration: 0.8 }}
              className="flex gap-9 pt-8" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              {[
                { v: "2.4M+", l: "Jobs Analyzed" },
                { v: "94%",   l: "Response Rate" },
                { v: "12K+",  l: "Offers Landed" },
              ].map(({ v, l }) => (
                <div key={l}>
                  <div className="heading-gradient text-2xl font-black" style={{ fontFamily: "Unbounded, sans-serif" }}>{v}</div>
                  <div className="text-white/35 text-xs tracking-wide mt-1">{l}</div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right — AI Core */}
          <motion.div initial={{ opacity: 0, scale: 0.82 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.42, duration: 1.3, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center justify-center">
            <AICore mx={mouse.x} my={mouse.y} />
          </motion.div>
        </div>

        {/* Scroll cue */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <span className="text-white/25 text-[10px] tracking-[0.28em]" style={{ fontFamily: "JetBrains Mono, monospace" }}>SCROLL</span>
          <div className="w-px h-10" style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.3), transparent)", animation: "float-b 2.2s ease-in-out infinite" }} />
        </motion.div>
      </motion.section>

      {/* ── AI WORKFORCE ─────────────────────────────────────────────────────── */}
      <section className="py-36 px-6">
        <div className="max-w-7xl mx-auto">
          <RevealBlock>
            <div className="text-white/30 text-[10px] tracking-[0.32em] uppercase mb-5"
              style={{ fontFamily: "JetBrains Mono, monospace" }}>01 — AI Workforce</div>
            <h2 className="heading-gradient text-[clamp(2.8rem,6vw,5.5rem)] font-black tracking-tight mb-5"
              style={{ fontFamily: "Unbounded, sans-serif" }}>
              Six Agents.<br />One Mission.
            </h2>
            <p className="text-white/38 text-base leading-relaxed max-w-lg mb-16">
              Each agent is a specialized AI, trained for a single purpose. Together they form an unstoppable, autonomous job search system.
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
      <section className="py-36 px-6">
        <div className="max-w-7xl mx-auto">
          <RevealBlock>
            <div className="text-white/30 text-[10px] tracking-[0.32em] uppercase mb-5"
              style={{ fontFamily: "JetBrains Mono, monospace" }}>02 — Protocol Sequence</div>
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
      <section className="py-36 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <RevealBlock>
            <div className="text-white/30 text-[10px] tracking-[0.32em] uppercase mb-5"
              style={{ fontFamily: "JetBrains Mono, monospace" }}>03 — Global Intelligence</div>
            <h2 className="heading-gradient text-[clamp(2.8rem,6vw,5rem)] font-black tracking-tight mb-6"
              style={{ fontFamily: "Unbounded, sans-serif" }}>
              Watching<br />Every Market.
            </h2>
            <p className="text-white/38 text-base leading-relaxed mb-10 max-w-md">
              Ghost Protocol monitors job markets across every major city and remote-first company, ensuring zero opportunity goes undetected.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { v: "200+",  l: "Job Boards" },
                { v: "50M+",  l: "Positions Tracked" },
                { v: "190",   l: "Countries" },
                { v: "< 30s", l: "Discovery Speed" },
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
                      ghost-protocol.ai/dashboard
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
                      { l: "Applications Sent", v: "847", s: "+34 today" },
                      { l: "Responses",          v: "127", s: "15% rate" },
                      { l: "Interviews",         v: "23",  s: "+5 this week" },
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
                          { co: "Anthropic", role: "Senior ML Engineer",  st: "Interview",  ago: "2h" },
                          { co: "OpenAI",    role: "Product Manager",      st: "Applied",    ago: "4h" },
                          { co: "Vercel",    role: "Frontend Engineer",    st: "Reviewing",  ago: "6h" },
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
                              <span className={`text-[9px] px-2 py-0.5 rounded-full ${st === "Interview" ? "text-white/80" : "text-white/35"}`}
                                style={{ background: st === "Interview" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
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
      <section className="py-36 px-6">
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
      <section className="py-36 px-6">
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
              style={{ fontFamily: "JetBrains Mono, monospace" }}>Initialize Protocol</div>
            <h2 className="heading-gradient text-[clamp(3rem,8vw,7rem)] font-black tracking-tight leading-[0.9] mb-8"
              style={{ fontFamily: "Unbounded, sans-serif" }}>
              Let AI Handle<br />Your Job Search.
            </h2>
            <p className="text-white/40 text-lg mb-12 max-w-lg mx-auto leading-relaxed">
              Join 12,000+ professionals who let Ghost Protocol run their job search while they build their future.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <button className="glow-btn-white px-11 py-5 bg-white text-black font-semibold text-sm tracking-wide rounded-full transition-all duration-300">
                Start Free
              </button>
              <button className="glow-btn-glass glass flex items-center gap-2 px-11 py-5 text-white font-medium text-sm tracking-wide rounded-full group transition-all duration-300">
                Launch Dashboard
                <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform duration-300" />
              </button>
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
              style={{ fontFamily: "Unbounded, sans-serif" }}>Ghost Protocol</span>
          </div>

          <div className="flex flex-wrap gap-6 text-white/28 text-xs">
            {["Privacy", "Terms", "Security", "API", "Documentation", "Status"].map(item => (
              <a key={item} href="#" className="hover:text-white/55 transition-colors duration-300">{item}</a>
            ))}
          </div>

          <div className="text-white/18 text-[10px]" style={{ fontFamily: "JetBrains Mono, monospace" }}>
            © 2025 Ghost Protocol. All rights reserved.
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
