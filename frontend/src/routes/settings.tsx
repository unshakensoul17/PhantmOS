import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "../components/Layout";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import {
  Settings, Key, Clock, ShieldAlert, Bell, Cpu,
  Save, Loader2, Plus, X, Mail
} from "lucide-react";
import { apiFetch } from "../lib/api";

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
      });
    }
  }, [data]);

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
    }
  });

  if (isLoading || !localSettings) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-neon-blue mb-4" />
          <div className="font-mono text-muted-foreground text-sm">Decrypting Secure Vault...</div>
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
      <div className="space-y-6 animate-fade-up">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
          <div>
            <div className="text-[13px] font-mono text-neon-blue mb-1">Command Center</div>
            <h2 className="text-3xl font-bold tracking-tight">System Preferences</h2>
          </div>
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="h-10 px-6 rounded-xl bg-gradient-to-r from-neon-blue to-neon-cyan text-black font-bold flex items-center gap-2 hover:scale-[1.02] transition shadow-lg shadow-neon-blue/20"
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Configuration
          </button>
        </div>

        <div className="grid lg:grid-cols-12 gap-8 items-start">

          {/* Side Menu */}
          <div className="lg:col-span-3 space-y-2">
            <button
              onClick={() => setActiveTab('api')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition font-medium ${activeTab === 'api' ? 'bg-white/10 text-white' : 'text-muted-foreground hover:bg-white/5 hover:text-white'}`}
            >
              <Key className="w-4 h-4" /> API Vault
            </button>
            <button
              onClick={() => setActiveTab('scoring')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition font-medium ${activeTab === 'scoring' ? 'bg-white/10 text-white' : 'text-muted-foreground hover:bg-white/5 hover:text-white'}`}
            >
              <ShieldAlert className="w-4 h-4" /> Scoring Filters
            </button>
            <button
              onClick={() => setActiveTab('scheduler')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition font-medium ${activeTab === 'scheduler' ? 'bg-white/10 text-white' : 'text-muted-foreground hover:bg-white/5 hover:text-white'}`}
            >
              <Clock className="w-4 h-4" /> Cron Scheduler
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition font-medium ${activeTab === 'notifications' ? 'bg-white/10 text-white' : 'text-muted-foreground hover:bg-white/5 hover:text-white'}`}
            >
              <Bell className="w-4 h-4" /> Routing Matrix
            </button>
            <button
              onClick={() => setActiveTab('appearance')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition font-medium ${activeTab === 'appearance' ? 'bg-white/10 text-white' : 'text-muted-foreground hover:bg-white/5 hover:text-white'}`}
            >
              <Save className="w-4 h-4" /> Resume Appearance
            </button>
          </div>

          {/* Settings Panels */}
          <div className="lg:col-span-9">

            {/* API VAULT */}
            {activeTab === 'api' && (
              <div className="glass-strong rounded-2xl p-6 md:p-8 animate-in fade-in">
                <div className="mb-8">
                  <h3 className="text-xl font-bold flex items-center gap-2 mb-2"><Key className="w-5 h-5 text-neon-purple" /> Secure API Vault</h3>
                  <p className="text-muted-foreground text-sm">Configure your LLM engines and securely store provider keys.</p>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold mb-2">Primary Reasoning Engine</label>
                      <select
                        value={localSettings.llm.primary_engine || "groq|llama-3.1-8b-instant"}
                        onChange={(e) => updateLLM('primary_engine', e.target.value)}
                        className="w-full h-11 px-4 rounded-xl glass bg-black/40 border border-white/10 focus:outline-none focus:border-neon-purple/50 appearance-none"
                      >
                        <optgroup label="Groq (Ultra-Fast)" className="bg-[#0B1020] text-white font-semibold">
                          <option value="groq|llama-3.1-8b-instant" className="bg-[#0B1020] text-white">Llama 3.1 8B Instant</option>
                          <option value="groq|llama3-70b-8192" className="bg-[#0B1020] text-white">Llama 3 70B</option>
                          <option value="groq|mixtral-8x7b-32768" className="bg-[#0B1020] text-white">Mixtral 8x7B</option>
                          <option value="groq|gemma2-9b-it" className="bg-[#0B1020] text-white">Gemma 2 9B IT</option>
                        </optgroup>
                        <optgroup label="Google Gemini" className="bg-[#0B1020] text-white font-semibold">
                          <option value="gemini|gemini-1.5-flash" className="bg-[#0B1020] text-white">Gemini 1.5 Flash</option>
                          <option value="gemini|gemini-1.5-pro" className="bg-[#0B1020] text-white">Gemini 1.5 Pro</option>
                        </optgroup>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-2">Secondary Engine (Fallback)</label>
                      <select
                        value={localSettings.llm.secondary_engine || "gemini|gemini-1.5-flash"}
                        onChange={(e) => updateLLM('secondary_engine', e.target.value)}
                        className="w-full h-11 px-4 rounded-xl glass bg-black/40 border border-white/10 focus:outline-none focus:border-neon-purple/50 appearance-none"
                      >
                        <optgroup label="Google Gemini" className="bg-[#0B1020] text-white font-semibold">
                          <option value="gemini|gemini-1.5-flash" className="bg-[#0B1020] text-white">Gemini 1.5 Flash</option>
                          <option value="gemini|gemini-1.5-pro" className="bg-[#0B1020] text-white">Gemini 1.5 Pro</option>
                        </optgroup>
                        <optgroup label="Groq (Ultra-Fast)" className="bg-[#0B1020] text-white font-semibold">
                          <option value="groq|llama-3.1-8b-instant" className="bg-[#0B1020] text-white">Llama 3.1 8B Instant</option>
                          <option value="groq|llama3-70b-8192" className="bg-[#0B1020] text-white">Llama 3 70B</option>
                          <option value="groq|mixtral-8x7b-32768" className="bg-[#0B1020] text-white">Mixtral 8x7B</option>
                          <option value="groq|gemma2-9b-it" className="bg-[#0B1020] text-white">Gemma 2 9B IT</option>
                        </optgroup>
                      </select>
                    </div>
                  </div>

                  <hr className="border-white/10" />

                  <div>
                    <label className="block text-sm font-semibold mb-2">Groq API Key</label>
                    <input
                      type="password"
                      value={localSettings.llm.groq_api_key}
                      onChange={(e) => updateLLM('groq_api_key', e.target.value)}
                      placeholder="gsk_..."
                      className="w-full h-11 px-4 rounded-xl glass bg-black/40 border border-white/10 focus:outline-none focus:border-neon-purple/50 font-mono text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2">Gemini API Key</label>
                    <input
                      type="password"
                      value={localSettings.llm.gemini_api_key}
                      onChange={(e) => updateLLM('gemini_api_key', e.target.value)}
                      placeholder="AIza..."
                      className="w-full h-11 px-4 rounded-xl glass bg-black/40 border border-white/10 focus:outline-none focus:border-neon-purple/50 font-mono text-sm"
                    />
                  </div>

                  <hr className="border-white/10" />

                  <div className="mb-2">
                    <h3 className="text-lg font-bold flex items-center gap-2 mb-2"><Mail className="w-5 h-5 text-neon-purple" /> Email Dispatcher</h3>
                    <p className="text-muted-foreground text-sm">Configure SMTP to enable the "Send Cold Email" feature.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2">Gmail Address</label>
                    <input
                      type="email"
                      value={localSettings.llm.gmail_user || ""}
                      onChange={(e) => updateLLM('gmail_user', e.target.value)}
                      placeholder="your.email@gmail.com"
                      className="w-full h-11 px-4 rounded-xl glass bg-black/40 border border-white/10 focus:outline-none focus:border-neon-purple/50 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Gmail App Password</label>
                    <input
                      type="password"
                      value={localSettings.llm.gmail_app_password || ""}
                      onChange={(e) => updateLLM('gmail_app_password', e.target.value)}
                      placeholder="abcd efgh ijkl mnop"
                      className="w-full h-11 px-4 rounded-xl glass bg-black/40 border border-white/10 focus:outline-none focus:border-neon-purple/50 font-mono text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SCORING */}
            {activeTab === 'scoring' && (
              <div className="glass-strong rounded-2xl p-6 md:p-8 animate-in fade-in">
                <div className="mb-8">
                  <h3 className="text-xl font-bold flex items-center gap-2 mb-2"><ShieldAlert className="w-5 h-5 text-neon-cyan" /> Guardrails & Filters</h3>
                  <p className="text-muted-foreground text-sm">Tune the AI strictness and automatically reject toxic roles.</p>
                </div>

                <div className="space-y-8">
                  <div>
                    <div className="flex justify-between items-end mb-4">
                      <label className="block text-sm font-semibold">Minimum Match Threshold</label>
                      <span className="text-xl font-bold font-mono text-neon-cyan">{localSettings.scoring.telegram_threshold}%</span>
                    </div>
                    <input
                      type="range" min="40" max="100"
                      value={localSettings.scoring.telegram_threshold}
                      onChange={(e) => updateScoring('telegram_threshold', parseInt(e.target.value))}
                      className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-neon-cyan"
                    />
                    <p className="text-xs text-muted-foreground mt-2">The system will only alert you for jobs scoring above this threshold.</p>
                  </div>

                  <hr className="border-white/10" />

                  <div>
                    <label className="block text-sm font-semibold mb-2">Company Blacklist</label>
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
                        className="flex-1 h-10 px-3 rounded-lg glass bg-black/40 border border-white/10 focus:outline-none text-sm"
                      />
                      <button onClick={() => {
                        if (newCompany) { updateScoring('blacklist_companies', [...localSettings.scoring.blacklist_companies, newCompany]); setNewCompany(""); }
                      }} className="h-10 px-4 rounded-lg bg-white/10 hover:bg-white/20 transition"><Plus className="w-4 h-4" /></button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {localSettings.scoring.blacklist_companies.map((c: string) => (
                        <span key={c} className="flex items-center gap-1.5 px-3 py-1 rounded bg-neon-pink/10 text-neon-pink text-xs border border-neon-pink/20">
                          {c} <button onClick={() => updateScoring('blacklist_companies', localSettings.scoring.blacklist_companies.filter((x: string) => x !== c))}><X className="w-3 h-3 hover:text-white" /></button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2">Keyword Blacklist (Auto-Reject)</label>
                    <div className="flex gap-2 mb-3">
                      <input
                        type="text" value={newKeyword} onChange={e => setNewKeyword(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newKeyword) {
                            updateScoring('blacklist_keywords', [...localSettings.scoring.blacklist_keywords, newKeyword]);
                            setNewKeyword("");
                          }
                        }}
                        placeholder="e.g. Secret Clearance, Unpaid..."
                        className="flex-1 h-10 px-3 rounded-lg glass bg-black/40 border border-white/10 focus:outline-none text-sm"
                      />
                      <button onClick={() => {
                        if (newKeyword) { updateScoring('blacklist_keywords', [...localSettings.scoring.blacklist_keywords, newKeyword]); setNewKeyword(""); }
                      }} className="h-10 px-4 rounded-lg bg-white/10 hover:bg-white/20 transition"><Plus className="w-4 h-4" /></button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {localSettings.scoring.blacklist_keywords.map((c: string) => (
                        <span key={c} className="flex items-center gap-1.5 px-3 py-1 rounded bg-neon-amber/10 text-neon-amber text-xs border border-neon-amber/20">
                          {c} <button onClick={() => updateScoring('blacklist_keywords', localSettings.scoring.blacklist_keywords.filter((x: string) => x !== c))}><X className="w-3 h-3 hover:text-white" /></button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SCHEDULER */}
            {activeTab === 'scheduler' && (
              <div className="glass-strong rounded-2xl p-6 md:p-8 animate-in fade-in">
                <div className="mb-8">
                  <h3 className="text-xl font-bold flex items-center gap-2 mb-2"><Clock className="w-5 h-5 text-neon-blue" /> Autonomous Scraping</h3>
                  <p className="text-muted-foreground text-sm">Control when the headless browser wakes up to hunt for jobs.</p>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold mb-2">Run frequency (Hours)</label>
                    <select
                      value={localSettings.scheduler.frequency_hours}
                      onChange={(e) => updateScheduler('frequency_hours', parseInt(e.target.value))}
                      className="w-full h-11 px-4 rounded-xl glass bg-black/40 border border-white/10 focus:outline-none focus:border-neon-blue/50 appearance-none"
                    >
                      <option value={2} className="bg-[#0B1020] text-white">Every 2 Hours (Aggressive)</option>
                      <option value={4} className="bg-[#0B1020] text-white">Every 4 Hours (Balanced)</option>
                      <option value={12} className="bg-[#0B1020] text-white">Twice a day (Conservative)</option>
                      <option value={24} className="bg-[#0B1020] text-white">Once a day</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl glass border border-white/5 bg-black/20">
                    <div>
                      <div className="font-semibold text-sm">Pause on Weekends</div>
                      <div className="text-xs text-muted-foreground mt-1">Halt background scraping on Saturdays and Sundays.</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={localSettings.scheduler.pause_weekends} onChange={(e) => updateScheduler('pause_weekends', e.target.checked)} />
                      <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-neon-blue"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* NOTIFICATIONS */}
            {activeTab === 'notifications' && (
              <div className="glass-strong rounded-2xl p-6 md:p-8 animate-in fade-in">
                <div className="mb-8">
                  <h3 className="text-xl font-bold flex items-center gap-2 mb-2"><Bell className="w-5 h-5 text-neon-green" /> Delivery Matrix</h3>
                  <p className="text-muted-foreground text-sm">How the agents should deliver intelligence to you.</p>
                </div>

                <div className="space-y-4">
                  {/* Telegram Connection Banner */}
                  <div className="p-5 rounded-xl border border-neon-blue/30 bg-neon-blue/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-white flex items-center gap-2">
                        <svg className="w-5 h-5 text-[#0088cc]" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.892-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>
                        Link Telegram Account
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Connect your Telegram account to receive instant job alerts and auto-apply directly from your phone.
                      </p>
                    </div>
                    {user ? (
                      localSettings.telegram_connected ? (
                        <div className="whitespace-nowrap px-4 py-2 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg font-medium flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          Connected
                        </div>
                      ) : (
                        <a
                          href={`https://t.me/siro_command_center_bot?start=${user.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="whitespace-nowrap px-4 py-2 bg-[#0088cc] hover:bg-[#0077b5] text-white rounded-lg font-medium transition-colors shadow-lg shadow-[#0088cc]/20"
                        >
                          Connect Telegram
                        </a>
                      )
                    ) : (
                      <button disabled className="px-4 py-2 bg-gray-600 text-white rounded-lg opacity-50">Log in first</button>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl glass border border-white/5 bg-black/20">
                    <div>
                      <div className="font-semibold text-sm">Instant Telegram Alerts</div>
                      <div className="text-xs text-muted-foreground mt-1">Ping your phone instantly when a job passes the threshold.</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={localSettings.notifications.instant_telegram_alerts} onChange={(e) => updateNotifications('instant_telegram_alerts', e.target.checked)} />
                      <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-neon-green"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl glass border border-white/5 bg-black/20">
                    <div>
                      <div className="font-semibold text-sm">Daily Digest Email</div>
                      <div className="text-xs text-muted-foreground mt-1">Send a summary of all harvested jobs at 9:00 AM.</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={localSettings.notifications.daily_digest_email} onChange={(e) => updateNotifications('daily_digest_email', e.target.checked)} />
                      <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-neon-green"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="glass-strong rounded-2xl p-6 md:p-8 animate-in fade-in">
                <div className="mb-8">
                  <h3 className="text-xl font-bold flex items-center gap-2 mb-2"><Save className="w-5 h-5 text-neon-cyan" /> Resume Appearance</h3>
                  <p className="text-muted-foreground text-sm">Choose the RenderCV template used to generate your PDF resumes.</p>
                </div>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Select Template</label>
                      <select 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-neon-cyan/50 transition-all font-mono"
                      value={localSettings.resume_template || 'sb2nov'}
                      onChange={(e) => setLocalSettings({ ...localSettings, resume_template: e.target.value })}
                    >
                      <option value="sb2nov">SB2Nov (Default Tech)</option>
                      <option value="classic">Classic (RenderCV Standard)</option>
                      <option value="engineeringresumes">Engineering Resumes (Dense)</option>
                      <option value="moderncv">ModernCV (Two-column layout)</option>
                    </select>
                    <p className="text-xs text-muted-foreground mt-2">This template will be applied to all newly tailored resumes.</p>
                  </div>

                  <div className="mt-6 p-6 rounded-xl border border-white/10 bg-black/40">
                    <h4 className="text-sm font-medium text-white mb-4">Template Preview</h4>
                    <div className="w-full max-w-md mx-auto rounded-xl shadow-[0_0_40px_rgba(0,0,0,0.5)] overflow-hidden border border-white/10 relative group">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition duration-300 pointer-events-none" />
                      <img 
                        src={`/templates/${localSettings.resume_template || 'sb2nov'}.png`} 
                        alt={`${localSettings.resume_template} preview`} 
                        className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105"
                        loading="lazy"
                      />
                    </div>
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
