import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "../components/Layout";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import {
  Key, Clock, ShieldAlert, Bell,
  Save, Loader2, Plus, X, Mail
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("api");
  const [localSettings, setLocalSettings] = useState<any>(null);
  const [newCompany, setNewCompany] = useState("");
  const [newKeyword, setNewKeyword] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await apiFetch("/api/settings");
      if (!res.ok) throw new Error("Failed to fetch settings");
      return res.json();
    },
  });

  useEffect(() => {
    if (data) {
      const defaultSettings = {
        llm: { groq_api_key: "", gemini_api_key: "", primary_engine: "groq|llama-3.1-8b-instant", secondary_engine: "groq|llama-3.1-8b-instant" },
        scoring: { target_roles: [], blacklist_keywords: [], blacklist_companies: [], telegram_threshold: 80 },
        scheduler: { frequency_hours: 4, pause_weekends: true },
        notifications: { daily_digest: true, instant_telegram_alerts: false }
      };
      
      setLocalSettings({
        llm: { ...defaultSettings.llm, ...(data.llm || {}) },
        scoring: { ...defaultSettings.scoring, ...(data.scoring || {}) },
        scheduler: { ...defaultSettings.scheduler, ...(data.scheduler || {}) },
        notifications: { ...defaultSettings.notifications, ...(data.notifications || {}) },
        telegram_connected: data.telegram_connected || false,
      });
    }
  }, [data]);

  const { data: telegramLinkData } = useQuery({
    queryKey: ["telegram-link"],
    queryFn: async () => {
      const res = await apiFetch("/api/telegram/link");
      if (!res.ok) return { link: "" };
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (updatedSettings: any) => {
      const res = await apiFetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedSettings),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Settings saved successfully!");
    },
    onError: (err: any) => {
      toast.error("Failed to save settings: " + err.message);
    }
  });

  if (isLoading || !localSettings) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-96 text-zinc-500">
          <Loader2 className="w-8 h-8 animate-spin text-white mb-3" />
          <div className="text-sm">Loading settings...</div>
        </div>
      </Layout>
    );
  }

  const handleSave = () => {
    saveMutation.mutate(localSettings);
  };

  const updateLLM = (key: string, val: any) => setLocalSettings({ ...localSettings, llm: { ...localSettings.llm, [key]: val } });
  const updateScoring = (key: string, val: any) => setLocalSettings({ ...localSettings, scoring: { ...localSettings.scoring, [key]: val } });
  const updateScheduler = (key: string, val: any) => setLocalSettings({ ...localSettings, scheduler: { ...localSettings.scheduler, [key]: val } });
  const updateNotifications = (key: string, val: any) => setLocalSettings({ ...localSettings, notifications: { ...localSettings.notifications, [key]: val } });

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">System Preferences</h1>
            <p className="text-sm text-zinc-400 mt-1">Configure AI reasoning engines, job scraping intervals, and scoring thresholds.</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="h-10 px-5 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs inline-flex items-center gap-2 transition disabled:opacity-50 shrink-0 shadow-sm"
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Configuration
          </button>
        </div>

        <div className="grid lg:grid-cols-12 gap-6 items-start">
          {/* Side Menu */}
          <div className="lg:col-span-3 space-y-1.5 bg-zinc-950 rounded-2xl p-2">
            {[
              { id: "api", label: "API Vault", icon: Key },
              { id: "scoring", label: "Scoring Filters", icon: ShieldAlert },
              { id: "scheduler", label: "Cron Scheduler", icon: Clock },
              { id: "notifications", label: "Delivery & Alerts", icon: Bell },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition text-xs font-medium ${
                    isActive ? "bg-white text-black font-semibold shadow-sm" : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                  }`}
                >
                  <Icon className="w-4 h-4" /> {tab.label}
                </button>
              );
            })}
          </div>

          {/* Settings Panels */}
          <div className="lg:col-span-9 bg-zinc-950 rounded-2xl p-6">
            {/* API VAULT */}
            {activeTab === 'api' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-white">AI Engine Configuration</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">Configure your LLM reasoning engines and API provider keys.</p>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1.5">Primary Reasoning Engine</label>
                      <select
                        value={localSettings.llm.primary_engine || "groq|llama-3.1-8b-instant"}
                        onChange={(e) => updateLLM('primary_engine', e.target.value)}
                        className="w-full h-10 px-3 rounded-lg bg-black text-white text-xs focus:outline-none"
                      >
                        <optgroup label="Groq" className="bg-black text-white">
                          <option value="groq|llama-3.1-8b-instant">Llama 3.1 8B Instant</option>
                          <option value="groq|llama3-70b-8192">Llama 3 70B</option>
                          <option value="groq|mixtral-8x7b-32768">Mixtral 8x7B</option>
                        </optgroup>
                        <optgroup label="Google Gemini" className="bg-black text-white">
                          <option value="gemini|gemini-1.5-flash">Gemini 1.5 Flash</option>
                          <option value="gemini|gemini-1.5-pro">Gemini 1.5 Pro</option>
                        </optgroup>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1.5">Secondary Engine (Fallback)</label>
                      <select
                        value={localSettings.llm.secondary_engine || "gemini|gemini-1.5-flash"}
                        onChange={(e) => updateLLM('secondary_engine', e.target.value)}
                        className="w-full h-10 px-3 rounded-lg bg-black text-white text-xs focus:outline-none"
                      >
                        <option value="gemini|gemini-1.5-flash">Gemini 1.5 Flash</option>
                        <option value="groq|llama-3.1-8b-instant">Llama 3.1 8B Instant</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">Groq API Key</label>
                    <input
                      type="password"
                      value={localSettings.llm.groq_api_key}
                      onChange={(e) => updateLLM('groq_api_key', e.target.value)}
                      placeholder="gsk_..."
                      className="w-full h-10 px-3 rounded-lg bg-black text-white text-xs focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">Gemini API Key</label>
                    <input
                      type="password"
                      value={localSettings.llm.gemini_api_key}
                      onChange={(e) => updateLLM('gemini_api_key', e.target.value)}
                      placeholder="AIza..."
                      className="w-full h-10 px-3 rounded-lg bg-black text-white text-xs focus:outline-none font-mono"
                    />
                  </div>

                  <div className="pt-2">
                    <h4 className="text-sm font-semibold text-white mb-1">Email Dispatcher (Gmail SMTP)</h4>
                    <p className="text-xs text-zinc-400 mb-3">Enable sending recruiter follow-up emails directly from PhantmOS.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1.5">Gmail Address</label>
                      <input
                        type="email"
                        value={localSettings.llm.gmail_user || ""}
                        onChange={(e) => updateLLM('gmail_user', e.target.value)}
                        placeholder="your.email@gmail.com"
                        className="w-full h-10 px-3 rounded-lg bg-black text-white text-xs focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1.5">Gmail App Password</label>
                      <input
                        type="password"
                        value={localSettings.llm.gmail_app_password || ""}
                        onChange={(e) => updateLLM('gmail_app_password', e.target.value)}
                        placeholder="App password"
                        className="w-full h-10 px-3 rounded-lg bg-black text-white text-xs focus:outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SCORING */}
            {activeTab === 'scoring' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-white">Match Filters and Guardrails</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">Filter out toxic roles or blacklisted companies.</p>
                </div>

                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <label className="text-xs font-medium text-zinc-400">Minimum Match Threshold</label>
                      <span className="text-lg font-bold font-mono text-white">{localSettings.scoring.telegram_threshold}%</span>
                    </div>
                    <input
                      type="range" min="40" max="100"
                      value={localSettings.scoring.telegram_threshold}
                      onChange={(e) => updateScoring('telegram_threshold', parseInt(e.target.value))}
                      className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">Company Blacklist</label>
                    <div className="flex gap-2 mb-3">
                      <input
                        type="text" value={newCompany} onChange={e => setNewCompany(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newCompany) {
                            updateScoring('blacklist_companies', [...localSettings.scoring.blacklist_companies, newCompany]);
                            setNewCompany("");
                          }
                        }}
                        placeholder="e.g. Current Employer..."
                        className="flex-1 h-10 px-3 rounded-lg bg-black text-white text-xs focus:outline-none"
                      />
                      <button onClick={() => {
                        if (newCompany) { updateScoring('blacklist_companies', [...localSettings.scoring.blacklist_companies, newCompany]); setNewCompany(""); }
                      }} className="h-10 px-3.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium"><Plus className="w-4 h-4" /></button>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {localSettings.scoring.blacklist_companies.map((c: string, i: number) => (
                        <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black text-xs text-zinc-300">
                          {c}
                          <button onClick={() => {
                            const copy = [...localSettings.scoring.blacklist_companies];
                            copy.splice(i, 1);
                            updateScoring('blacklist_companies', copy);
                          }} className="hover:text-white"><X className="w-3 h-3" /></button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SCHEDULER */}
            {activeTab === 'scheduler' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-white">Autonomous Cron Scheduler</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">Control how often background agents harvest new job leads.</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">Run Frequency (Hours)</label>
                    <select
                      value={localSettings.scheduler.frequency_hours}
                      onChange={(e) => updateScheduler('frequency_hours', parseInt(e.target.value))}
                      className="w-full h-10 px-3 rounded-lg bg-black text-white text-xs focus:outline-none"
                    >
                      <option value={2}>Every 2 Hours</option>
                      <option value={4}>Every 4 Hours</option>
                      <option value={12}>Twice a day</option>
                      <option value={24}>Once a day</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-black">
                    <div>
                      <div className="font-semibold text-xs text-white">Pause on Weekends</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">Halt background scraping on Saturdays and Sundays.</div>
                    </div>
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded bg-black accent-white cursor-pointer" 
                      checked={localSettings.scheduler.pause_weekends} 
                      onChange={(e) => updateScheduler('pause_weekends', e.target.checked)} 
                    />
                  </div>
                </div>
              </div>
            )}

            {/* NOTIFICATIONS */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-white">Delivery and Telegram Alerts</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">Receive job matches and notifications directly to your phone.</p>
                </div>

                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-xs text-white">Telegram Account Sync</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">Connect your Telegram account to receive instant job alerts.</div>
                    </div>
                    {user ? (
                      localSettings.telegram_connected ? (
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 bg-zinc-900 text-white rounded-lg text-xs font-mono">
                            Connected
                          </span>
                          <a
                            href={telegramLinkData?.link || `https://t.me/placeholder_bot?start=${user.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs font-medium transition"
                          >
                            Reconnect
                          </a>
                        </div>
                      ) : (
                        <a
                          href={telegramLinkData?.link || `https://t.me/placeholder_bot?start=${user.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-white hover:bg-zinc-200 text-black rounded-lg text-xs font-semibold transition"
                        >
                          Connect Telegram
                        </a>
                      )
                    ) : (
                      <button disabled className="px-3 py-1 bg-zinc-900 text-zinc-500 rounded-lg text-xs">Log in first</button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
