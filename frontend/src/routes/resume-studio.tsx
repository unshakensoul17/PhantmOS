import { apiFetch } from "../lib/api";
import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "../components/Layout";
import { Upload, Loader2, Save, Plus, Trash2, Code } from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/resume-studio")({
  component: ResumeStudioPage,
});

const EMPTY_PROFILE = {
  target_role: "",
  cv: {
    name: "", email: "", phone: "", location: "",
    social_networks: [],
    sections: {
      summary: [],
      education: [],
      experience: [],
      projects: [],
      skills: []
    }
  }
};

function ResumeStudioPage() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState<any>(EMPTY_PROFILE);
  const [activeTab, setActiveTab] = useState("basics");
  const [viewMode, setViewMode] = useState<"visual"|"json">("visual");
  const [jsonText, setJsonText] = useState("");
  const [resumeTemplate, setResumeTemplate] = useState("sb2nov");

  const { data: serverProfile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await apiFetch("/api/profile");
      if (!res.ok) return EMPTY_PROFILE;
      const data = await res.json();
      return (data && Object.keys(data).length > 0) ? data : EMPTY_PROFILE;
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (serverProfile) {
      setProfile(serverProfile);
    }
  }, [serverProfile]);

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await apiFetch("/api/settings");
      if (!res.ok) return {};
      const data = await res.json();
      if (data.resume_template) {
        setResumeTemplate(data.resume_template);
      }
      return data;
    }
  });

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
      d.cv.social_networks[idx].username = value;
    } else {
      d.cv.social_networks.push({ network, url: value, username: value });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = viewMode === "json" ? JSON.parse(jsonText) : profile;
      
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
      if (!res.ok) throw new Error("Failed to save profile on server");

      if (settings) {
        await apiFetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...settings, resume_template: resumeTemplate }),
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      
      toast.success("Profile & appearance saved successfully!");
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
            toast.success("Resume parsed successfully!");
        }
        setIsUploading(false);
      } catch (err: any) {
        console.error(err);
        setIsUploading(false);
        toast.error(err.message || "Parsing failed.");
      }
    }
  };



  const hasName = Boolean(profile.cv?.name);
  const hasRole = Boolean(profile.target_role);
  const hasLinkedIn = Boolean(getSocial("LinkedIn"));
  const hasExperience = Boolean(profile.cv?.sections?.experience?.length > 0);
  const hasSkills = Boolean(profile.cv?.sections?.skills?.length > 0);

  const completedCount = [hasName, hasRole, hasLinkedIn, hasExperience, hasSkills].filter(Boolean).length;
  const readinessPct = Math.round((completedCount / 5) * 100);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">My Resume</h1>
            <p className="text-sm text-zinc-400 mt-1">
              Create a resume that fits the jobs you want.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="h-10 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-medium cursor-pointer inline-flex items-center gap-2 transition shrink-0">
              <input type="file" className="hidden" accept=".pdf" onChange={handleUpload} />
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Upload className="w-4 h-4 text-white" />}
              <span>{isUploading ? "Reading resume..." : "Upload Resume"}</span>
            </label>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="h-10 px-5 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs inline-flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
          </div>
        </div>

        {/* Readiness Info */}
        <div className="bg-zinc-950 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-zinc-900">
          <div>
            <div className="text-sm font-semibold text-white">Resume Status: {readinessPct >= 80 ? "Ready to Use" : "Add more details"}</div>
            <div className="text-xs text-zinc-400 mt-0.5">
              {readinessPct >= 80 ? "Your resume has enough information for finding good jobs." : "Fill in your job title and work experience to get better matches."}
            </div>
          </div>
          <div className="font-mono text-sm font-bold text-white bg-black px-3.5 py-1.5 rounded-lg">
            {readinessPct}% Complete
          </div>
        </div>

        {/* Form Container */}
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Navigation Tabs */}
          <div className="lg:col-span-1 space-y-2">
            {viewMode === "visual" && (
              <div className="bg-zinc-950 rounded-2xl p-2 flex flex-col gap-1">
                {[
                  { id: "basics", label: "Basic Information" },
                  { id: "experience", label: "Work Experience" },
                  { id: "education", label: "Education" },
                  { id: "projects", label: "Projects" },
                  { id: "skills", label: "Skills" },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`text-left px-3.5 py-2.5 rounded-xl text-xs font-medium transition ${
                      activeTab === tab.id
                        ? "bg-white text-black font-semibold shadow-sm"
                        : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Form Content */}
          <div className="bg-zinc-950 rounded-2xl p-6 lg:col-span-3 min-h-[480px]">
            {viewMode === "json" ? (
              <textarea 
                value={jsonText} 
                onChange={e => setJsonText(e.target.value)}
                className="w-full h-full min-h-[480px] p-4 rounded-xl bg-black text-zinc-200 text-xs focus:outline-none font-mono leading-relaxed" 
                spellCheck={false}
              />
            ) : (
              <div className="space-y-6">
                {activeTab === "basics" && (
                  <div className="space-y-4">
                    <h3 className="text-base font-semibold text-white">Basic Information</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-zinc-400 mb-1.5 block">Target Role (for AI matching)</label>
                        <input className="w-full h-10 px-3.5 rounded-lg bg-black text-white text-xs focus:outline-none" value={profile.target_role || ""} onChange={e => updateProfile(d => d.target_role = e.target.value)} placeholder="e.g. Frontend Developer, AI Intern" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-zinc-400 mb-1.5 block">Full Name</label>
                        <input className="w-full h-10 px-3.5 rounded-lg bg-black text-white text-xs focus:outline-none" value={profile.cv?.name || ""} onChange={e => updateProfile(d => { if(!d.cv) d.cv={}; d.cv.name = e.target.value })} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-zinc-400 mb-1.5 block">Email</label>
                        <input className="w-full h-10 px-3.5 rounded-lg bg-black text-white text-xs focus:outline-none" value={profile.cv?.email || ""} onChange={e => updateProfile(d => d.cv.email = e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-zinc-400 mb-1.5 block">Phone</label>
                        <input className="w-full h-10 px-3.5 rounded-lg bg-black text-white text-xs focus:outline-none" value={profile.cv?.phone || ""} onChange={e => updateProfile(d => d.cv.phone = e.target.value)} />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-xs font-medium text-zinc-400 mb-1.5 block">Location</label>
                        <input className="w-full h-10 px-3.5 rounded-lg bg-black text-white text-xs focus:outline-none" value={profile.cv?.location || ""} onChange={e => updateProfile(d => d.cv.location = e.target.value)} placeholder="e.g. San Francisco, CA or Remote" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-zinc-400 mb-1.5 block">LinkedIn URL</label>
                        <input className="w-full h-10 px-3.5 rounded-lg bg-black text-white text-xs focus:outline-none" value={getSocial("LinkedIn")} onChange={e => updateProfile(d => setSocial(d, "LinkedIn", e.target.value))} placeholder="https://linkedin.com/in/..." />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-zinc-400 mb-1.5 block">GitHub URL</label>
                        <input className="w-full h-10 px-3.5 rounded-lg bg-black text-white text-xs focus:outline-none" value={getSocial("GitHub")} onChange={e => updateProfile(d => setSocial(d, "GitHub", e.target.value))} placeholder="https://github.com/..." />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-xs font-medium text-zinc-400 mb-1.5 block">Professional Summary</label>
                        <textarea className="w-full h-24 p-3.5 rounded-lg bg-black text-white text-xs focus:outline-none resize-none" value={profile.cv?.sections?.summary?.[0] || ""} onChange={e => updateProfile(d => { if(!d.cv.sections) d.cv.sections={}; d.cv.sections.summary = [e.target.value] })} />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "experience" && (
                  <ListEditor 
                    title="Work Experience" 
                    items={profile.cv?.sections?.experience || []} 
                    onUpdate={(newItems) => updateProfile(d => { if(!d.cv.sections) d.cv.sections={}; d.cv.sections.experience = newItems; })}
                    emptyItem={{ company: "", position: "", location: "", date: "", highlights: [""] }}
                    renderItem={(item, updateItem) => (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input placeholder="Company Name" className="h-10 px-3.5 rounded-lg bg-black text-white text-xs focus:outline-none" value={item.company || ""} onChange={e => updateItem({...item, company: e.target.value})} />
                        <input placeholder="Position / Title" className="h-10 px-3.5 rounded-lg bg-black text-white text-xs focus:outline-none" value={item.position || ""} onChange={e => updateItem({...item, position: e.target.value})} />
                        <input placeholder="Dates (e.g. 2022-06 to Present)" className="h-10 px-3.5 rounded-lg bg-black text-white text-xs focus:outline-none" value={item.date || (item.start_date ? `${item.start_date} to ${item.end_date || 'Present'}` : "")} onChange={e => updateItem({...item, date: e.target.value})} />
                        <input placeholder="Location" className="h-10 px-3.5 rounded-lg bg-black text-white text-xs focus:outline-none" value={item.location || ""} onChange={e => updateItem({...item, location: e.target.value})} />
                        <div className="sm:col-span-2">
                          <label className="text-[11px] font-medium text-zinc-400 mb-1 block">Key Achievements / Bullets (One per line)</label>
                          <textarea className="w-full h-28 p-3.5 rounded-lg bg-black text-white text-xs focus:outline-none resize-none" value={(item.highlights || []).join("\n")} onChange={e => updateItem({...item, highlights: e.target.value.split("\n").filter(x=>x.trim())})} />
                        </div>
                      </div>
                    )}
                  />
                )}

                {activeTab === "projects" && (
                  <ListEditor 
                    title="Key Projects" 
                    items={profile.cv?.sections?.projects || []} 
                    onUpdate={(newItems) => updateProfile(d => { if(!d.cv.sections) d.cv.sections={}; d.cv.sections.projects = newItems; })}
                    emptyItem={{ name: "", url: "", date: "", highlights: [""] }}
                    renderItem={(item, updateItem) => (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input placeholder="Project Name" className="h-10 px-3.5 rounded-lg bg-black text-white text-xs focus:outline-none" value={item.name || ""} onChange={e => updateItem({...item, name: e.target.value})} />
                        <input placeholder="Dates" className="h-10 px-3.5 rounded-lg bg-black text-white text-xs focus:outline-none" value={item.date || ""} onChange={e => updateItem({...item, date: e.target.value})} />
                        <input placeholder="Project / Repo URL" className="sm:col-span-2 h-10 px-3.5 rounded-lg bg-black text-white text-xs focus:outline-none" value={item.url || ""} onChange={e => updateItem({...item, url: e.target.value})} />
                        <div className="sm:col-span-2">
                          <label className="text-[11px] font-medium text-zinc-400 mb-1 block">Project Highlights (One per line)</label>
                          <textarea className="w-full h-24 p-3.5 rounded-lg bg-black text-white text-xs focus:outline-none resize-none" value={(item.highlights || []).join("\n")} onChange={e => updateItem({...item, highlights: e.target.value.split("\n").filter(x=>x.trim())})} />
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input placeholder="Institution / University" className="h-10 px-3.5 rounded-lg bg-black text-white text-xs focus:outline-none" value={item.institution || ""} onChange={e => updateItem({...item, institution: e.target.value})} />
                        <input placeholder="Field of Study / Major" className="h-10 px-3.5 rounded-lg bg-black text-white text-xs focus:outline-none" value={item.area || ""} onChange={e => updateItem({...item, area: e.target.value})} />
                        <input placeholder="Degree (e.g. BS, BTech)" className="h-10 px-3.5 rounded-lg bg-black text-white text-xs focus:outline-none" value={item.degree || ""} onChange={e => updateItem({...item, degree: e.target.value})} />
                        <input placeholder="Dates" className="h-10 px-3.5 rounded-lg bg-black text-white text-xs focus:outline-none" value={item.date || ""} onChange={e => updateItem({...item, date: e.target.value})} />
                      </div>
                    )}
                  />
                )}

                {activeTab === "skills" && (
                  <ListEditor 
                    title="Skills & Technologies" 
                    items={profile.cv?.sections?.skills || []} 
                    onUpdate={(newItems) => updateProfile(d => { if(!d.cv.sections) d.cv.sections={}; d.cv.sections.skills = newItems; })}
                    emptyItem={{ label: "", details: "" }}
                    renderItem={(item, updateItem) => (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input placeholder="Category (e.g. Languages, Tools)" className="h-10 px-3.5 rounded-lg bg-black text-white text-xs focus:outline-none" value={item.label || ""} onChange={e => updateItem({...item, label: e.target.value})} />
                        <input placeholder="Skills (e.g. React, Python, PostgreSQL)" className="h-10 px-3.5 rounded-lg bg-black text-white text-xs focus:outline-none" value={item.details || ""} onChange={e => updateItem({...item, details: e.target.value})} />
                      </div>
                    )}
                  />
                )}

                {/* RESUME APPEARANCE TAB */}
                {activeTab === "appearance" && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-base font-semibold text-white">Resume Appearance & PDF Template</h3>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Choose the RenderCV template used to format and style all tailored PDF resumes.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-2">Select Template</label>
                        <select 
                          className="w-full bg-black rounded-xl px-4 py-3 text-white focus:outline-none font-mono text-xs"
                          value={resumeTemplate}
                          onChange={(e) => setResumeTemplate(e.target.value)}
                        >
                          <option value="sb2nov">SB2Nov (Standard Tech Clean)</option>
                          <option value="classic">Classic (Standard Academic)</option>
                          <option value="engineeringresumes">Engineering Resumes (Dense)</option>
                          <option value="moderncv">ModernCV (Two-column layout)</option>
                        </select>
                        <p className="text-[11px] text-zinc-500 mt-1.5">This template layout will be applied when exporting tailored resumes.</p>
                      </div>

                      <div className="mt-4 p-5 rounded-xl bg-black">
                        <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">Template Preview</h4>
                        <div className="w-full max-w-sm mx-auto rounded-xl shadow-2xl overflow-hidden bg-white">
                          <img 
                            src={`/templates/${resumeTemplate || 'sb2nov'}.png`} 
                            alt={`${resumeTemplate} preview`} 
                            className="w-full h-auto object-cover"
                            loading="lazy"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

function ListEditor({ title, items, onUpdate, emptyItem, renderItem }: { title: string, items: any[], onUpdate: (items: any[]) => void, emptyItem: any, renderItem: (item: any, updateItem: (i: any) => void) => React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <button 
          onClick={() => onUpdate([...items, emptyItem])}
          className="h-8 px-3.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-200 inline-flex items-center gap-1.5 transition"
        >
          <Plus className="w-3.5 h-3.5" /> Add New
        </button>
      </div>
      
      {items.length === 0 && (
        <div className="text-xs text-zinc-500 py-8 text-center bg-black/40 rounded-xl">
          No {title.toLowerCase()} added yet. Click "Add New" above.
        </div>
      )}

      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className="relative bg-black p-4 rounded-xl">
            <button 
              onClick={() => { const copy = [...items]; copy.splice(idx, 1); onUpdate(copy); }}
              className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-900 transition"
              title="Delete item"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <div className="pr-8">
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
