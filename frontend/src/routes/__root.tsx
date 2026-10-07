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
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
            Lost in Cyberspace
          </h1>
          <p className="text-sm md:text-base text-zinc-400 max-w-md mx-auto leading-relaxed">
            The coordinates you navigated to do not exist or were decommissioned by PhantmOS protocols.
          </p>
        </div>

        {/* Quick Navigation Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-left">
          <Link
            to="/dashboard"
            className="p-3.5 rounded-xl bg-zinc-950 hover:bg-zinc-900 border border-white/5 hover:border-white/20 transition-all group flex flex-col justify-between"
          >
            <div className="w-8 h-8 rounded-lg bg-zinc-900 group-hover:bg-zinc-800 grid place-items-center mb-2 transition">
              <LayoutDashboard className="w-4 h-4 text-zinc-300 group-hover:text-white" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white">Dashboard</div>
              <div className="text-[11px] text-zinc-500 mt-0.5">Live status & telemetry</div>
            </div>
          </Link>

          <Link
            to="/job-discovery"
            className="p-3.5 rounded-xl bg-zinc-950 hover:bg-zinc-900 border border-white/5 hover:border-white/20 transition-all group flex flex-col justify-between"
          >
            <div className="w-8 h-8 rounded-lg bg-zinc-900 group-hover:bg-zinc-800 grid place-items-center mb-2 transition">
              <Search className="w-4 h-4 text-zinc-300 group-hover:text-white" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white">Job Discovery</div>
              <div className="text-[11px] text-zinc-500 mt-0.5">Explore active roles</div>
            </div>
          </Link>

          <Link
            to="/resume-studio"
            className="p-3.5 rounded-xl bg-zinc-950 hover:bg-zinc-900 border border-white/5 hover:border-white/20 transition-all group flex flex-col justify-between"
          >
            <div className="w-8 h-8 rounded-lg bg-zinc-900 group-hover:bg-zinc-800 grid place-items-center mb-2 transition">
              <FileText className="w-4 h-4 text-zinc-300 group-hover:text-white" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white">Resume Studio</div>
              <div className="text-[11px] text-zinc-500 mt-0.5">Tailor & manage CV</div>
            </div>
          </Link>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
          <button
            onClick={() => window.history.back()}
            className="h-10 px-5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold inline-flex items-center gap-2 transition border border-white/5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Go Back
          </button>
          <Link
            to="/"
            className="h-10 px-6 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold inline-flex items-center gap-2 transition shadow-sm"
          >
            <Home className="w-3.5 h-3.5" /> Return to Base
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
            Telemetry Interrupted
          </h1>
          <p className="mt-1.5 text-xs text-zinc-400 leading-relaxed">
            An unexpected glitch occurred while rendering this interface.
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
            <Home className="w-3.5 h-3.5" /> Dashboard
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
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PhantmOS Engine | Autonomous AI Job Search Command Center" },
      { name: "description", content: "Enterprise-grade autonomous AI job search ecosystem. Multi-agent discovery, ranking, resume tailoring, and application automation." },
      { name: "author", content: "PhantmOS" },
      { property: "og:title", content: "PhantmOS Engine" },
      { property: "og:description", content: "Autonomous AI Job Search Command Center — multi-agent recruitment automation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
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
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
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
