import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "../hooks/useAuth";
import { Toaster } from "../components/ui/sonner";

import {
  Compass, ArrowLeft, Sparkles, LayoutDashboard, Search, FileText,
  Home, RefreshCw, ShieldAlert
} from "lucide-react";

function NotFoundComponent() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = decodeURIComponent(window.location.pathname || "").toLowerCase().trim();
      const clean = raw.replace(/[_\s\+]+/g, "-").replace(/^\/+|\/+$/g, "");
      
      if (clean === "resume-studio" || clean === "resume" || clean === "resumes" || clean.includes("resume") || clean.includes("cv")) {
        router.navigate({ to: "/resume-studio" });
        return;
      }
      if (clean === "job-discovery" || clean === "jobs" || clean === "job" || clean.includes("job") || clean.includes("discover")) {
        router.navigate({ to: "/job-discovery" });
        return;
      }
      if (clean === "company-research" || clean === "companies" || clean === "company" || clean.includes("company") || clean.includes("intel")) {
        router.navigate({ to: "/company-research" });
        return;
      }
      if (clean === "applications" || clean === "applied" || clean === "apps" || clean.includes("app")) {
        router.navigate({ to: "/applications" });
        return;
      }
      if (clean === "settings" || clean === "preferences" || clean.includes("setting")) {
        router.navigate({ to: "/settings" });
        return;
      }
      if (clean === "radar" || clean === "feed" || clean.includes("radar")) {
        router.navigate({ to: "/radar" });
        return;
      }
      if (clean === "dashboard" || clean === "home" || clean === "dash") {
        router.navigate({ to: "/dashboard" });
        return;
      }
    } catch {}
  }, [router]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4 relative overflow-hidden font-sans select-none">
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-white/[0.03] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-12 left-1/2 -translate-x-1/2 w-72 h-72 bg-zinc-900/50 rounded-full blur-[100px] pointer-events-none" />

      {/* Main 404 Container */}
      <div className="relative z-10 max-w-xl w-full text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
        
        {/* Radar Icon with glowing ring */}
        <div className="mx-auto w-20 h-20 rounded-2xl bg-zinc-950 border border-white/10 flex items-center justify-center relative shadow-2xl">
          <div className="absolute inset-0 rounded-2xl bg-white/5 animate-pulse" />
          <Compass className="w-10 h-10 text-white animate-[spin_10s_linear_infinite]" />
        </div>

        {/* Status Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-white/10 text-zinc-400 text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          <span>404 // SIGNAL_LOST</span>
        </div>

        {/* Headline & Description */}
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
            This page could not be found.
          </h1>
          <p className="text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
            The page you are looking for does not exist or has moved.
          </p>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
          <Link
            to="/"
            className="h-10 px-5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold inline-flex items-center gap-2 transition"
          >
            <Home className="w-3.5 h-3.5" /> Go Home
          </Link>
          <Link
            to="/dashboard"
            className="h-10 px-6 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold inline-flex items-center gap-2 transition shadow-sm"
          >
            <LayoutDashboard className="w-3.5 h-3.5" /> Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4 relative font-sans select-none">
      <div className="relative z-10 max-w-md w-full text-center space-y-5 bg-zinc-950 p-8 rounded-2xl border border-white/10 shadow-2xl">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 grid place-items-center mx-auto">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Something went wrong.
          </h1>
          <p className="mt-1.5 text-xs text-zinc-400 leading-relaxed">
            Please try again.
          </p>
        </div>
        <div className="flex justify-center gap-2 pt-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="h-9 px-4 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold inline-flex items-center gap-1.5 transition shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Try Again
          </button>
          <Link
            to="/dashboard"
            className="h-9 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium inline-flex items-center gap-1.5 transition border border-white/5"
          >
            <Home className="w-3.5 h-3.5" /> Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=5" },
      { title: "PhantmOS — Autonomous AI Job Search & Career Operating System" },
      { name: "description", content: "PhantmOS (phantmos) is the autonomous AI operating system for job search, résumé optimization, cold outreach, and career intelligence. Automate your job hunt end-to-end." },
      { name: "keywords", content: "PhantmOS, phantmos, Phantm OS, phantm os, AI job search, autonomous career OS, resume studio, AI resume builder, job tracker, automated job application, ATS resume checker, AI career assistant" },
      { name: "author", content: "PhantmOS" },
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" },
      { name: "googlebot", content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" },
      { name: "bingbot", content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" },
      { name: "theme-color", content: "#000000" },
      { name: "google-site-verification", content: "SqNpJbvJt7FpmZApqtkJ5JVkiqmMyhH0OMRzovetuRY" },
      { property: "og:site_name", content: "PhantmOS" },
      { property: "og:title", content: "PhantmOS — Autonomous AI Job Search & Career Operating System" },
      { property: "og:description", content: "PhantmOS (phantmos) finds jobs, improves your resume, automates applications, and runs your job search 24/7 on autopilot." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://unshakensoul17-phantmos.hf.space/" },
      { property: "og:image", content: "https://unshakensoul17-phantmos.hf.space/logo.png" },
      { property: "og:locale", content: "en_US" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@phantmos" },
      { name: "twitter:creator", content: "@phantmos" },
      { name: "twitter:title", content: "PhantmOS — Autonomous AI Job Search & Career Operating System" },
      { name: "twitter:description", content: "PhantmOS (phantmos) finds jobs, improves your resume, automates applications, and runs your job search 24/7 on autopilot." },
      { name: "twitter:image", content: "https://unshakensoul17-phantmos.hf.space/logo.png" },
    ],
    links: [
      { rel: "canonical", href: "https://unshakensoul17-phantmos.hf.space/" },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", href: "/logo.png" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Unbounded:wght@400;600;800;900&display=swap" },
      { rel: "icon", href: "/logo.png", type: "image/png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": "https://unshakensoul17-phantmos.hf.space/#website",
        "name": "PhantmOS",
        "alternateName": ["phantmos", "Phantm OS", "phantm os", "PhantmOS AI"],
        "url": "https://unshakensoul17-phantmos.hf.space/",
        "description": "PhantmOS is an autonomous AI career operating system that finds jobs, optimizes resumes, and automates applications."
      },
      {
        "@type": "WebApplication",
        "@id": "https://unshakensoul17-phantmos.hf.space/#webapp",
        "name": "PhantmOS",
        "alternateName": ["phantmos", "Phantm OS"],
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "All",
        "url": "https://unshakensoul17-phantmos.hf.space/",
        "description": "Autonomous AI job search and career intelligence platform."
      },
      {
        "@type": "Organization",
        "@id": "https://unshakensoul17-phantmos.hf.space/#organization",
        "name": "PhantmOS",
        "alternateName": "phantmos",
        "url": "https://unshakensoul17-phantmos.hf.space/",
        "logo": "https://unshakensoul17-phantmos.hf.space/logo.png",
        "sameAs": ["https://github.com/unshakensoul17/PhantmOS"]
      }
    ]
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="google-site-verification" content="SqNpJbvJt7FpmZApqtkJ5JVkiqmMyhH0OMRzovetuRY" />
        <HeadContent />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script src="https://telegram.org/js/telegram-web-app.js" async></script>
      </head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
