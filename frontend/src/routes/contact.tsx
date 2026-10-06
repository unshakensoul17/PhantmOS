import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "../components/Layout";
import { Github, Linkedin, Mail } from "lucide-react";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
});

function ContactPage() {
  const team = [
    {
      name: "Ali Ahmad",
      email: "aliahmad071205@gmail.com",
      linkedin: "https://www.linkedin.com/in/ali-ahmad-raza-sheikh-760aa335b",
      github: "https://github.com/ali071205",
      photo: "/ali.jpg", // The user needs to save the first image as ali.jpg in public folder
      role: "Contributor"
    },
    {
      name: "Uwesh Khan",
      email: "uweshk34@gmail.com",
      linkedin: "https://www.linkedin.com/in/uwesh-khan-875aa1378",
      github: "https://github.com/uweshkhan0000",
      photo: "/uwesh.jpg", // The user needs to save the second image as uwesh.jpg in public folder
      role: "Contributor"
    },
    {
      name: "Akash Yaduwanshi",
      email: "aakashyaduwanshi0470@gmail.com",
      linkedin: "https://www.linkedin.com/in/akash-yaduwanshi-902a3b352",
      github: "https://github.com/unshakensoul17",
      photo: "/akash.jpg", // The user needs to save the third image as akash.jpg in public folder
      role: "Contributor"
    }
  ];

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-8 animate-fade-up pb-12">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold tracking-tight mb-4 text-white">
            Meet Our <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-blue to-neon-purple">Team</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Get in touch with the brilliant minds behind this project. We are always open to collaborating!
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {team.map((member, idx) => (
            <div key={idx} className="glass-strong rounded-3xl p-6 flex flex-col items-center text-center transition-all hover:scale-105 border border-white/5 hover:border-neon-purple/30 group overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-neon-blue/5 to-neon-purple/5 opacity-0 group-hover:opacity-100 transition-opacity z-0 pointer-events-none" />
              
              <div className="relative z-10 w-32 h-32 rounded-full overflow-hidden border-4 border-[#0B1020] shadow-xl mb-6 ring-2 ring-white/10 group-hover:ring-neon-purple/50 transition-all bg-black/40">
                <img 
                  src={member.photo} 
                  alt={member.name} 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=0B1020&color=fff&size=256`;
                  }}
                />
              </div>
              
              <h3 className="text-2xl font-bold text-white mb-1 relative z-10">{member.name}</h3>
              <p className="text-neon-purple font-medium mb-6 relative z-10">{member.role}</p>
              
              <div className="flex gap-4 relative z-10 mt-auto">
                <a href={`mailto:${member.email}`} className="p-3 rounded-full bg-black/40 text-muted-foreground hover:text-white hover:bg-white/10 transition-colors border border-white/5" title="Email">
                  <Mail className="w-5 h-5" />
                </a>
                <a href={member.linkedin} target="_blank" rel="noreferrer" className="p-3 rounded-full bg-black/40 text-muted-foreground hover:text-[#0077B5] hover:bg-white/10 transition-colors border border-white/5" title="LinkedIn">
                  <Linkedin className="w-5 h-5" />
                </a>
                <a href={member.github} target="_blank" rel="noreferrer" className="p-3 rounded-full bg-black/40 text-muted-foreground hover:text-white hover:bg-white/10 transition-colors border border-white/5" title="GitHub">
                  <Github className="w-5 h-5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
