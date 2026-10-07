import { apiFetch } from "../lib/api";
import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "../components/Layout";
import { Upload, Loader2, Save, Plus, Trash2, Code, LayoutTemplate, Check, FileText } from "lucide-react";
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

const TEMPLATE_NAMES: Record<string, { name: string; short: string }> = {
  sb2nov: { name: "SB2Nov (Standard Tech)", short: "SB2Nov" },
  classic: { name: "Classic (Academic)", short: "Classic" },
  engineeringresumes: { name: "Engineering Resumes", short: "Engineering Resumes" },
  moderncv: { name: "ModernCV (Two-Column)", short: "ModernCV" },
};

function getTemplateDisplayName(id: string, short = false): string {
  const entry = TEMPLATE_NAMES[id?.toLowerCase()];
  if (entry) return short ? entry.short : entry.name;
  return id ? id.charAt(0).toUpperCase() + id.slice(1) : "SB2Nov";
}

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
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== "application/pdf" && !selectedFile.name.toLowerCase().endsWith(".pdf")) {
        toast.error("Please select a PDF file (.pdf)");
        return;
      }
      setFile(selectedFile);
      setIsUploading(true);
      const formData = new FormData();
      formData.append("resume", selectedFile);
      try {
        const res = await apiFetch("/api/profile/upload", { method: "POST", body: formData });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.detail || "Failed to upload and parse resume.");
        }
        if (data?.status === "success" && data.profile) {
          setProfile(data.profile);
          queryClient.invalidateQueries({ queryKey: ["profile"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
          toast.success("Resume uploaded and parsed successfully!");
        } else {
          throw new Error(data?.detail || "Invalid resume response.");
        }
      } catch (err: any) {
        console.error("Resume upload error:", err);
        toast.error(err.message || "Failed to parse resume.");
      } finally {
        setIsUploading(false);
        e.target.value = "";
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
              Create and customize a high-impact resume tailored for your target roles.
            </p>
          </div>
          <div className="flex items-center flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("appearance")}
              className="h-10 px-3.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-800 inline-flex items-center gap-2 transition"
            >
              <LayoutTemplate className="w-4 h-4 text-emerald-400" />
              <span>Format:</span>
              <span className="font-semibold text-white">{getTemplateDisplayName(resumeTemplate, true)}</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode(viewMode === "visual" ? "json" : "visual")}
              className="h-10 px-3.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-800 inline-flex items-center gap-2 transition"
            >
              <Code className="w-4 h-4 text-zinc-400" />
              <span>{viewMode === "visual" ? "JSON Mode" : "Visual Mode"}</span>
            </button>

            <label className="h-10 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-medium cursor-pointer inline-flex items-center gap-2 transition shrink-0 border border-zinc-800">
              <input type="file" className="hidden" accept=".pdf" onChange={handleUpload} />
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Upload className="w-4 h-4 text-white" />}
              <span>{isUploading ? "Reading resume..." : "Upload PDF"}</span>
            </label>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="h-10 px-5 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs inline-flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
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
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-400">Template: <span className="font-semibold text-white">{getTemplateDisplayName(resumeTemplate, true)}</span></span>
            <div className="font-mono text-sm font-bold text-white bg-black px-3.5 py-1.5 rounded-lg border border-zinc-800">
              {readinessPct}% Complete
            </div>
          </div>
        </div>

        {/* Form Container */}
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Navigation Tabs */}
          <div className="lg:col-span-1 space-y-2">
            {viewMode === "visual" && (
              <div className="bg-zinc-950 rounded-2xl p-2 flex flex-col gap-1 border border-zinc-900">
                {[
                  { id: "basics", label: "Basic Information" },
                  { id: "experience", label: "Work Experience" },
                  { id: "education", label: "Education" },
                  { id: "projects", label: "Projects" },
                  { id: "skills", label: "Skills" },
                  { id: "appearance", label: "Format & Template" },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center justify-between text-left px-3.5 py-2.5 rounded-xl text-xs font-medium transition ${
                      activeTab === tab.id
                        ? "bg-white text-black font-semibold shadow-sm"
                        : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                    }`}
                  >
                    <span>{tab.label}</span>
                    {tab.id === "appearance" && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${activeTab === tab.id ? "bg-black/10 text-black" : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"}`}>
                        {getTemplateDisplayName(resumeTemplate, true)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Form Content */}
          <div className="bg-zinc-950 rounded-2xl p-6 lg:col-span-3 min-h-[480px] border border-zinc-900">
            {viewMode === "json" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Direct JSON Schema Editor</span>
                  <button onClick={() => setViewMode("visual")} className="text-white hover:underline">Switch to Visual Form</button>
                </div>
                <textarea 
                  value={jsonText} 
                  onChange={e => setJsonText(e.target.value)}
                  className="w-full min-h-[520px] p-4 rounded-xl bg-black text-zinc-200 text-xs focus:outline-none font-mono leading-relaxed border border-zinc-800" 
                  spellCheck={false}
                />
              </div>
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

                {/* RESUME FORMAT & TEMPLATES TAB */}
                {activeTab === "appearance" && (
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center gap-2">
                        <LayoutTemplate className="w-5 h-5 text-emerald-400" />
                        <h3 className="text-base font-semibold text-white">Select Resume Format & Template</h3>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">
                        Choose the layout format for your generated PDF resumes. Click any format to select and preview it.
                      </p>
                    </div>

                    {/* Format Grid Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        {
                          id: "sb2nov",
                          name: "SB2Nov",
                          subtitle: "Standard Tech & Clean",
                          description: "Clean single-column layout with high ATS compatibility. Standard across tech & engineering.",
                          tag: "Recommended",
                          badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                        },
                        {
                          id: "classic",
                          name: "Classic",
                          subtitle: "Traditional & Academic",
                          description: "Traditional serif typography with formal sectioning. Ideal for research and corporate roles.",
                          tag: "Academic",
                          badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
                        },
                        {
                          id: "engineeringresumes",
                          name: "Engineering Resumes",
                          subtitle: "Dense & High Impact",
                          description: "High density format designed to fit extensive technical stack and project highlights.",
                          tag: "Technical",
                          badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
                        },
                        {
                          id: "moderncv",
                          name: "ModernCV",
                          subtitle: "Contemporary Two-Column",
                          description: "Modern split layout with a structured sidebar for skills, contact, and certifications.",
                          tag: "Creative",
                          badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
                        },
                      ].map((fmt) => {
                        const isSelected = resumeTemplate === fmt.id;
                        return (
                          <div
                            key={fmt.id}
                            onClick={() => setResumeTemplate(fmt.id)}
                            className={`group relative rounded-2xl p-4 cursor-pointer transition-all duration-200 border text-left ${
                              isSelected
                                ? "bg-zinc-900 border-white ring-1 ring-white/20 shadow-lg shadow-white/5"
                                : "bg-black/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-semibold text-white">{fmt.name}</h4>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${fmt.badgeColor}`}>
                                    {fmt.tag}
                                  </span>
                                </div>
                                <p className="text-xs text-zinc-400 mt-0.5">{fmt.subtitle}</p>
                              </div>
                              <div
                                className={`w-5 h-5 rounded-full flex items-center justify-center transition ${
                                  isSelected ? "bg-white text-black" : "border border-zinc-700 text-transparent"
                                }`}
                              >
                                <Check className="w-3 h-3 stroke-[3]" />
                              </div>
                            </div>

                            <p className="text-xs text-zinc-400 mb-3 line-clamp-2">{fmt.description}</p>

                            {/* Thumbnail preview */}
                            <div className="w-full h-36 rounded-xl overflow-hidden bg-white/5 border border-zinc-800/80 relative">
                              <img
                                src={`/templates/${fmt.id}.png`}
                                alt={`${fmt.name} preview`}
                                className="w-full h-full object-cover object-top transition duration-200 group-hover:scale-105"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition flex items-end p-2">
                                <span className="text-[10px] font-medium text-white/90 bg-black/70 px-2 py-0.5 rounded-md backdrop-blur">
                                  Click to Select
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Selected Template Live Preview Panel */}
                    <div className="mt-6 p-6 rounded-2xl bg-black border border-zinc-800/80">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <div className="text-xs font-semibold text-white uppercase tracking-wider">
                            Active Format Preview: <span className="text-emerald-400 font-bold normal-case">{getTemplateDisplayName(resumeTemplate)}</span>
                          </div>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            This layout format will be used whenever you generate or export tailored PDF resumes.
                          </p>
                        </div>
                        <button
                          onClick={handleSave}
                          disabled={isSaving}
                          className="h-8 px-4 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs inline-flex items-center gap-1.5 transition shrink-0"
                        >
                          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                          Save Format
                        </button>
                      </div>

                      <div className="w-full max-w-md mx-auto rounded-xl shadow-2xl overflow-hidden bg-white border border-zinc-800">
                        <img 
                          src={`/templates/${resumeTemplate || 'sb2nov'}.png`} 
                          alt={`${resumeTemplate} full preview`} 
                          className="w-full h-auto object-cover"
                          loading="lazy"
                        />
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
