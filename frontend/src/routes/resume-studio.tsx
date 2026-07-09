import { apiFetch } from "../lib/api";
import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "../components/Layout";
import { Upload, Check, Loader2, Save, Plus, Trash2, Code } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/resume-studio")({
  component: ResumeStudioPage,
});

const DEFAULT_PROFILE = {
  target_role: "Software Engineer",
  cv: {
    name: "Your Name", email: "you@example.com", phone: "+1-555-0100", location: "San Francisco, CA",
    social_networks: [ { network: "LinkedIn", username: "yourusername" }, { network: "GitHub", username: "yourusername" } ],
    sections: {
      summary: ["A highly motivated engineer with 5+ years of experience in scalable systems."],
      education: [ { institution: "University of Example", area: "Computer Science", degree: "BS", date: "2018-08 to 2022-05", highlights: ["Graduated Summa Cum Laude"] } ],
      experience: [ { company: "Tech Corp", position: "Senior Engineer", location: "Remote", date: "2022-06 to present", highlights: ["Built a distributed pipeline that reduced latency by 40%."] } ],
      projects: [ { name: "Open Source Tool", date: "2023-01 to 2023-04", url: "https://github.com/...", highlights: ["Developed a CLI tool with 1k+ stars on GitHub."] } ],
      skills: [ { label: "Programming Languages", details: "Python, TypeScript, Go, Rust" } ]
    }
  }
};

function ResumeStudioPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("basics");
  const [viewMode, setViewMode] = useState<"visual"|"json">("visual");
  const [jsonText, setJsonText] = useState(""); // For manual JSON override

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await apiFetch("/api/profile");
        if (res.ok) {
          const data = await res.json();
          if (data && Object.keys(data).length > 0) {
            setProfile(data);
          } else {
            setProfile(DEFAULT_PROFILE);
          }
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
      }
    };
    loadProfile();
  }, []);

  useEffect(() => {
    if (profile && viewMode === "json") {
      setJsonText(JSON.stringify(profile, null, 2));
    }
  }, [viewMode, profile]);

  const updateProfile = (updater: (draft: any) => void) => {
    setProfile((prev: any) => {
      const draft = JSON.parse(JSON.stringify(prev));
      updater(draft);
      return draft;
    });
  };

  const getSocial = (network: string) => {
    const sn = profile?.cv?.social_networks?.find((s: any) => s.network?.toLowerCase() === network.toLowerCase());
    return sn?.url || sn?.username || "";
  };

  const setSocial = (d: any, network: string, value: string) => {
    if (!d.cv) d.cv = {};
    if (!d.cv.social_networks) d.cv.social_networks = [];
    const idx = d.cv.social_networks.findIndex((s: any) => s.network?.toLowerCase() === network.toLowerCase());
    if (idx >= 0) {
      d.cv.social_networks[idx].url = value;
      d.cv.social_networks[idx].username = value; // Maintain both for parser compatibility
    } else {
      d.cv.social_networks.push({ network, url: value, username: value });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = viewMode === "json" ? JSON.parse(jsonText) : profile;
      
      // Validation for mandatory LinkedIn and GitHub links
      const socials = payload?.cv?.social_networks || [];
      const linkedin = socials.find((s: any) => s.network?.toLowerCase() === "linkedin");
      const github = socials.find((s: any) => s.network?.toLowerCase() === "github");
      
      const isMocked = (val: string) => !val || val === "Link" || val === "null" || val.trim() === "";
      
      if (!linkedin || isMocked(linkedin.url)) {
        throw new Error("LinkedIn link is mandatory. Please provide a valid LinkedIn URL before saving.");
      }
      
      const liUrl = linkedin.url.toLowerCase();
      if (!liUrl.startsWith("https://linkedin.com/") && !liUrl.startsWith("https://www.linkedin.com/")) {
        throw new Error("Invalid LinkedIn link. It must start with https://linkedin.com/ or https://www.linkedin.com/");
      }

      if (!github || isMocked(github.url)) {
        throw new Error("GitHub link is mandatory. Please provide a valid GitHub URL before saving.");
      }

      const ghUrl = github.url.toLowerCase();
      if (!ghUrl.startsWith("https://github.com/") && !ghUrl.startsWith("https://www.github.com/")) {
        throw new Error("Invalid GitHub link. It must start with https://github.com/ or https://www.github.com/");
      }

      const res = await apiFetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume_data: payload }),
      });
      if (!res.ok) throw new Error("Failed to save on server");
      toast.success("Profile Saved Successfully!");
      if (viewMode === "json") setProfile(payload);
    } catch (err: any) {
      toast.error(err.message.includes("mandatory") || err.message.includes("Invalid") ? err.message : "Save Failed: " + err.message);
    }
    setIsSaving(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setIsUploading(true);
      const formData = new FormData();
      formData.append("resume", e.target.files[0]);
      try {
        const res = await apiFetch("/api/profile/upload", { method: "POST", body: formData });
        if (!res.ok) {
            const errData = await res.json().catch(() => null);
            throw new Error(errData?.detail || "Failed to upload");
        }
        const data = await res.json();
        if (data.status === "success" && data.profile) {
            setProfile(data.profile);
            toast.success("Resume uploaded successfully!");
            
            // Validate for mocked/missing data
            const warnings: string[] = [];
            const cv = data.profile.cv || {};
            
            // Check socials
            const socials = cv.social_networks || [];
            const linkedin = socials.find((s: any) => s.network?.toLowerCase() === "linkedin");
            if (!linkedin || !linkedin.url || linkedin.url === "Link" || linkedin.url === "null") {
              warnings.push("LinkedIn URL is missing or mocked.");
            }
            const github = socials.find((s: any) => s.network?.toLowerCase() === "github");
            if (!github || !github.url || github.url === "Link" || github.url === "null") {
              warnings.push("GitHub URL is missing or mocked.");
            }
            
            // Check education
            const education = cv.sections?.education || [];
            if (education.length === 0) {
              warnings.push("Education section is empty.");
            } else {
              education.forEach((edu: any, i: number) => {
                if (!edu.institution || edu.institution === "null") warnings.push(`Education #${i+1} is missing an institution.`);
                if (edu.degree === "null") warnings.push(`Education #${i+1} degree is marked as "null".`);
              });
            }

            // Check projects
            const projects = cv.sections?.projects || [];
            projects.forEach((proj: any, i: number) => {
              if (proj.url === "null" || proj.url === "Link") {
                warnings.push(`Project #${i+1} has a mocked URL.`);
              }
            });

            if (warnings.length > 0) {
              toast.warning(
                <div>
                  <p className="font-bold mb-1">Please review these fields:</p>
                  <ul className="list-disc pl-4 text-xs space-y-1">
                    {warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>,
                { duration: 10000 }
              );
            }
        }
        setIsUploading(false);
      } catch (err: any) {
        console.error(err);
        setIsUploading(false);
        toast.error(err.message || "Parsing failed.");
      }
    }
  };

  if (!profile) return <Layout><div className="p-10 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-neon-cyan" /></div></Layout>;

  return (
    <Layout>
      <div className="space-y-6 animate-fade-up">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <div className="text-[13px] font-mono text-neon-purple mb-1">Resume Studio</div>
            <h2 className="text-3xl font-bold tracking-tight">Master Profile Editor</h2>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setViewMode(v => v === "visual" ? "json" : "visual")}
              className="h-11 px-4 rounded-xl glass hover:bg-white/10 text-sm font-medium inline-flex items-center gap-2 transition">
              <Code className="w-4 h-4" />
              {viewMode === "visual" ? "Edit Raw JSON" : "Visual Editor"}
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="h-11 px-6 rounded-xl bg-gradient-to-r from-neon-blue to-neon-purple text-black font-semibold inline-flex items-center gap-2 hover:scale-[1.02] transition glow-blue disabled:opacity-50">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Profile
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Left Sidebar (Upload & Tabs) */}
          <div className="lg:col-span-1 space-y-4">
            <div className="glass-strong rounded-2xl p-4">
              <label className="relative flex flex-col items-center justify-center h-32 border border-dashed border-white/20 rounded-xl hover:bg-white/5 transition cursor-pointer group overflow-hidden bg-black/20">
                <input type="file" className="hidden" accept=".pdf" onChange={handleUpload} />
                {isUploading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-neon-cyan mb-2" />
                ) : file ? (
                  <Check className="w-6 h-6 text-neon-green mb-2" />
                ) : (
                  <Upload className="w-6 h-6 text-muted-foreground group-hover:text-neon-cyan transition mb-2" />
                )}
                <span className="text-xs font-mono">{isUploading ? "Parsing..." : "Upload Resume PDF"}</span>
              </label>
            </div>

            {viewMode === "visual" && (
              <div className="glass-strong rounded-2xl p-2 flex flex-col gap-1">
                {["basics", "experience", "projects", "education", "skills"].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`text-left px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                      activeTab === tab ? "bg-white/10 text-white" : "text-muted-foreground hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Editor Area */}
          <div className="glass-strong rounded-2xl p-6 lg:col-span-3 min-h-[500px]">
            {viewMode === "json" ? (
              <textarea 
                value={jsonText} 
                onChange={e => setJsonText(e.target.value)}
                className="w-full h-full min-h-[500px] p-4 rounded-xl glass text-sm focus:outline-none focus:ring-2 focus:ring-neon-purple/50 transition bg-black/40 font-mono leading-relaxed" 
                spellCheck={false}
              />
            ) : (
              <div className="space-y-6">
                {activeTab === "basics" && (
                  <div className="space-y-4 animate-fade-up">
                    <h3 className="text-lg font-bold mb-4">Basic Details</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-mono text-muted-foreground mb-1 block">Target Role (for AI Harvesting)</label>
                        <input className="w-full h-10 px-3 rounded-lg glass text-sm" value={profile.target_role || ""} onChange={e => updateProfile(d => d.target_role = e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs font-mono text-muted-foreground mb-1 block">Full Name</label>
                        <input className="w-full h-10 px-3 rounded-lg glass text-sm" value={profile.cv?.name || ""} onChange={e => updateProfile(d => { if(!d.cv) d.cv={}; d.cv.name = e.target.value })} />
                      </div>
                      <div>
                        <label className="text-xs font-mono text-muted-foreground mb-1 block">Email</label>
                        <input className="w-full h-10 px-3 rounded-lg glass text-sm" value={profile.cv?.email || ""} onChange={e => updateProfile(d => d.cv.email = e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs font-mono text-muted-foreground mb-1 block">Phone</label>
                        <input className="w-full h-10 px-3 rounded-lg glass text-sm" value={profile.cv?.phone || ""} onChange={e => updateProfile(d => d.cv.phone = e.target.value)} />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs font-mono text-muted-foreground mb-1 block">Location</label>
                        <input className="w-full h-10 px-3 rounded-lg glass text-sm" value={profile.cv?.location || ""} onChange={e => updateProfile(d => d.cv.location = e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs font-mono text-muted-foreground mb-1 block">LinkedIn URL</label>
                        <input className="w-full h-10 px-3 rounded-lg glass text-sm" value={getSocial("LinkedIn")} onChange={e => updateProfile(d => setSocial(d, "LinkedIn", e.target.value))} placeholder="https://linkedin.com/in/..." />
                      </div>
                      <div>
                        <label className="text-xs font-mono text-muted-foreground mb-1 block">GitHub URL</label>
                        <input className="w-full h-10 px-3 rounded-lg glass text-sm" value={getSocial("GitHub")} onChange={e => updateProfile(d => setSocial(d, "GitHub", e.target.value))} placeholder="https://github.com/..." />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs font-mono text-muted-foreground mb-1 block">Portfolio URL</label>
                        <input className="w-full h-10 px-3 rounded-lg glass text-sm" value={getSocial("Portfolio")} onChange={e => updateProfile(d => setSocial(d, "Portfolio", e.target.value))} placeholder="https://yourportfolio.com" />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs font-mono text-muted-foreground mb-1 block">Professional Summary</label>
                        <textarea className="w-full h-24 p-3 rounded-lg glass text-sm" value={profile.cv?.sections?.summary?.[0] || ""} onChange={e => updateProfile(d => { if(!d.cv.sections) d.cv.sections={}; d.cv.sections.summary = [e.target.value] })} />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "experience" && (
                  <ListEditor 
                    title="Experience" 
                    items={profile.cv?.sections?.experience || []} 
                    onUpdate={(newItems) => updateProfile(d => { if(!d.cv.sections) d.cv.sections={}; d.cv.sections.experience = newItems; })}
                    emptyItem={{ company: "", position: "", location: "", date: "", highlights: [""] }}
                    renderItem={(item, updateItem) => (
                      <div className="grid grid-cols-2 gap-3">
                        <input placeholder="Company" className="h-10 px-3 rounded-lg glass text-sm" value={item.company || ""} onChange={e => updateItem({...item, company: e.target.value})} />
                        <input placeholder="Position" className="h-10 px-3 rounded-lg glass text-sm" value={item.position || ""} onChange={e => updateItem({...item, position: e.target.value})} />
                        <input placeholder="Date (e.g. 2020-01 to 2023-01)" className="h-10 px-3 rounded-lg glass text-sm" 
                          value={item.date || (item.start_date ? `${item.start_date} to ${item.end_date || 'Present'}` : "")} 
                          onChange={e => {
                            const copy = {...item, date: e.target.value};
                            delete copy.start_date;
                            delete copy.end_date;
                            updateItem(copy);
                          }} 
                        />
                        <input placeholder="Location" className="h-10 px-3 rounded-lg glass text-sm" value={item.location || ""} onChange={e => updateItem({...item, location: e.target.value})} />
                        <div className="col-span-2">
                          <label className="text-[11px] font-mono text-muted-foreground mb-1 block">Highlights (One bullet per line)</label>
                          <textarea className="w-full h-32 p-3 rounded-lg glass text-sm" value={(item.highlights || []).join("\n")} onChange={e => updateItem({...item, highlights: e.target.value.split("\n").filter(x=>x.trim())})} />
                        </div>
                      </div>
                    )}
                  />
                )}

                {activeTab === "projects" && (
                  <ListEditor 
                    title="Projects" 
                    items={profile.cv?.sections?.projects || []} 
                    onUpdate={(newItems) => updateProfile(d => { if(!d.cv.sections) d.cv.sections={}; d.cv.sections.projects = newItems; })}
                    emptyItem={{ name: "", url: "", date: "", highlights: [""] }}
                    renderItem={(item, updateItem) => (
                      <div className="grid grid-cols-2 gap-3">
                        <input placeholder="Project Name" className="h-10 px-3 rounded-lg glass text-sm" value={item.name || ""} onChange={e => updateItem({...item, name: e.target.value})} />
                        <input placeholder="Date" className="h-10 px-3 rounded-lg glass text-sm" 
                          value={item.date || (item.start_date ? `${item.start_date} to ${item.end_date || 'Present'}` : "")} 
                          onChange={e => {
                            const copy = {...item, date: e.target.value};
                            delete copy.start_date;
                            delete copy.end_date;
                            updateItem(copy);
                          }} 
                        />
                        <input placeholder="URL (Optional)" className="col-span-2 h-10 px-3 rounded-lg glass text-sm" value={item.url || ""} onChange={e => updateItem({...item, url: e.target.value})} />
                        <div className="col-span-2">
                          <label className="text-[11px] font-mono text-muted-foreground mb-1 block">Highlights (One bullet per line)</label>
                          <textarea className="w-full h-24 p-3 rounded-lg glass text-sm" value={(item.highlights || []).join("\n")} onChange={e => updateItem({...item, highlights: e.target.value.split("\n").filter(x=>x.trim())})} />
                        </div>
                      </div>
                    )}
                  />
                )}

                {activeTab === "education" && (
                  <ListEditor 
                    title="Education" 
                    items={profile.cv?.sections?.education || []} 
                    onUpdate={(newItems) => updateProfile(d => { if(!d.cv.sections) d.cv.sections={}; d.cv.sections.education = newItems; })}
                    emptyItem={{ institution: "", area: "", degree: "", date: "", highlights: [] }}
                    renderItem={(item, updateItem) => (
                      <div className="grid grid-cols-2 gap-3">
                        <input placeholder="Institution" className="h-10 px-3 rounded-lg glass text-sm" value={item.institution || ""} onChange={e => updateItem({...item, institution: e.target.value})} />
                        <input placeholder="Area / Major" className="h-10 px-3 rounded-lg glass text-sm" value={item.area || ""} onChange={e => updateItem({...item, area: e.target.value})} />
                        <input placeholder="Degree (e.g. BS)" className="h-10 px-3 rounded-lg glass text-sm" value={item.degree || ""} onChange={e => updateItem({...item, degree: e.target.value})} />
                        <input placeholder="Date" className="h-10 px-3 rounded-lg glass text-sm" 
                          value={item.date || (item.start_date ? `${item.start_date} to ${item.end_date || 'Present'}` : "")} 
                          onChange={e => {
                            const copy = {...item, date: e.target.value};
                            delete copy.start_date;
                            delete copy.end_date;
                            updateItem(copy);
                          }} 
                        />
                      </div>
                    )}
                  />
                )}

                {activeTab === "skills" && (
                  <ListEditor 
                    title="Skills" 
                    items={profile.cv?.sections?.skills || []} 
                    onUpdate={(newItems) => updateProfile(d => { if(!d.cv.sections) d.cv.sections={}; d.cv.sections.skills = newItems; })}
                    emptyItem={{ label: "", details: "" }}
                    renderItem={(item, updateItem) => (
                      <div className="grid grid-cols-2 gap-3">
                        <input placeholder="Category (e.g. Languages)" className="h-10 px-3 rounded-lg glass text-sm" value={item.label || ""} onChange={e => updateItem({...item, label: e.target.value})} />
                        <input placeholder="Details (e.g. Python, Java)" className="h-10 px-3 rounded-lg glass text-sm" value={item.details || ""} onChange={e => updateItem({...item, details: e.target.value})} />
                      </div>
                    )}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

// Reusable array manager component
function ListEditor({ title, items, onUpdate, emptyItem, renderItem }: { title: string, items: any[], onUpdate: (items: any[]) => void, emptyItem: any, renderItem: (item: any, updateItem: (i: any) => void) => React.ReactNode }) {
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">{title}</h3>
        <button 
          onClick={() => onUpdate([...items, emptyItem])}
          className="h-8 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium inline-flex items-center gap-1.5 transition">
          <Plus className="w-3 h-3" /> Add Item
        </button>
      </div>
      
      {items.length === 0 && <div className="text-sm text-muted-foreground py-8 text-center border border-dashed border-white/10 rounded-xl">No {title.toLowerCase()} added yet.</div>}

      <div className="space-y-4">
        {items.map((item, idx) => (
          <div key={idx} className="relative glass p-4 rounded-xl border border-white/5">
            <button 
              onClick={() => { const copy = [...items]; copy.splice(idx, 1); onUpdate(copy); }}
              className="absolute top-2 right-2 w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition">
              <Trash2 className="w-4 h-4" />
            </button>
            <div className="pr-10">
              {renderItem(item, (updatedItem) => {
                const copy = [...items];
                copy[idx] = updatedItem;
                onUpdate(copy);
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
