import { apiFetch } from "../lib/api";
import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "../components/Layout";
import {
  Sparkles, Building2, ShieldCheck, Check, BookOpen, Search, Loader2
} from "lucide-react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";

export const Route = createFileRoute("/company-research")({
  component: CompanyResearchPage,
});

function CompanyResearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [researchData, setResearchData] = useState<any>(null);
  const [playbookData, setPlaybookData] = useState<any>(null);

  const researchMutation = useMutation({
    mutationFn: async (company: string) => {
      const res = await apiFetch(`/api/companies/research?company=${encodeURIComponent(company)}`);
      if (!res.ok) throw new Error("Failed to fetch research");
      return res.json();
    },
    onSuccess: (data) => {
      setResearchData(data);
      setPlaybookData(null);
    }
  });

  const playbookMutation = useMutation({
    mutationFn: async (company: string) => {
      const res = await apiFetch(`/api/companies/playbook?company=${encodeURIComponent(company)}`);
      if (!res.ok) throw new Error("Failed to fetch playbook");
      return res.json();
    },
    onSuccess: (data) => setPlaybookData(data)
  });

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Check a Company</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Learn important things about a company before you apply.
          </p>
        </div>

        {/* Search Bar */}
        <div className="bg-zinc-950 rounded-2xl p-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchQuery && !researchMutation.isPending) {
                    researchMutation.mutate(searchQuery);
                  }
                }}
                placeholder="Enter company name (example: Google, Microsoft, Stripe)..."
                className="w-full h-11 pl-10 pr-4 rounded-xl bg-black text-white text-sm placeholder:text-zinc-500 focus:outline-none"
              />
            </div>
            <button 
              onClick={() => researchMutation.mutate(searchQuery)}
              disabled={!searchQuery || researchMutation.isPending}
              className="h-11 px-6 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold inline-flex items-center justify-center gap-2 transition disabled:opacity-50 shrink-0 shadow-sm"
            >
              {researchMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
              {researchMutation.isPending ? "Checking company..." : "Check Company"}
            </button>
          </div>
        </div>

        {researchMutation.isPending && (
          <div className="py-20 flex flex-col items-center justify-center text-zinc-400">
            <Loader2 className="w-8 h-8 animate-spin text-white mb-2" />
            <p className="text-sm">Checking company information...</p>
          </div>
        )}

        {researchData && !researchMutation.isPending && (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Overview & Tech Stack Card */}
            <div className="bg-zinc-950 rounded-2xl p-6 space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-zinc-900 grid place-items-center font-bold font-mono text-white text-lg">
                    {researchData.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">{researchData.name}</h2>
                    <span className="text-xs text-zinc-400">{researchData.industry}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-zinc-900 text-white font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-white" />
                  {researchData.stability?.risk_label || "Currently Hiring"}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">What they use</h3>
                <div className="flex flex-wrap gap-1.5">
                  {researchData.stack.map((t: string) => (
                    <span key={t} className="text-xs px-2.5 py-1 rounded-lg bg-black text-zinc-200">
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">Recent News</h3>
                <div className="space-y-2 pl-2">
                  {researchData.news_timeline.map((n: string, j: number) => (
                    <div key={j} className="text-xs text-zinc-300 leading-relaxed">
                      {n}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-black rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1 text-xs font-semibold text-white">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                  <span>Things to know</span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">{researchData.insight}</p>
              </div>
            </div>

            {/* Interview Guide Section */}
            <div className="bg-zinc-950 rounded-2xl p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white flex items-center gap-2 text-base">
                  <BookOpen className="w-4 h-4 text-white" />
                  Interview Playbook
                </h3>
                {!playbookData && (
                  <button 
                    onClick={() => playbookMutation.mutate(researchData.name)}
                    disabled={playbookMutation.isPending}
                    className="h-8 px-3 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {playbookMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    Generate Guide
                  </button>
                )}
              </div>

              {!playbookData && !playbookMutation.isPending && (
                <div className="flex-1 grid place-items-center text-center p-8 bg-zinc-900/40 rounded-xl">
                  <div>
                    <BookOpen className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                    <p className="text-xs text-zinc-400 max-w-xs leading-relaxed">
                      Click "Generate Guide" to synthesize company culture, technical interview questions, and key product launches.
                    </p>
                  </div>
                </div>
              )}

              {playbookMutation.isPending && (
                <div className="flex-1 grid place-items-center text-center p-8">
                  <div>
                    <Loader2 className="w-8 h-8 animate-spin text-white mx-auto mb-2" />
                    <p className="text-xs text-zinc-400">Mining interview intel and historical questions...</p>
                  </div>
                </div>
              )}

              {playbookData && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2 font-mono">Company Values & Culture</h4>
                    <ul className="space-y-1.5">
                      {playbookData.cultural_values.map((v: string, i: number) => (
                        <li key={i} className="text-xs flex items-start gap-2 text-zinc-300">
                          <Check className="w-3.5 h-3.5 text-white mt-0.5 shrink-0" />
                          <span>{v}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2 font-mono">Historical Technical Questions</h4>
                    <div className="space-y-2">
                      {playbookData.technical_questions.map((q: any, i: number) => (
                        <div key={i} className="bg-black rounded-lg p-2.5">
                          <span className="text-[10px] font-mono text-zinc-400 uppercase block mb-0.5">{q.stage}</span>
                          <span className="text-xs text-zinc-200">{q.question}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2 font-mono">Recent Launches (Mention in interview)</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {playbookData.product_launches.map((p: string, i: number) => (
                        <span key={i} className="text-xs px-2.5 py-1 rounded-lg bg-zinc-900 text-zinc-300 font-mono">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {!researchData && !researchMutation.isPending && (
          <div className="py-20 text-center text-zinc-600 bg-zinc-900/30 rounded-2xl">
            <Building2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium text-zinc-400">Search any company to generate technical & cultural interview intelligence.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
