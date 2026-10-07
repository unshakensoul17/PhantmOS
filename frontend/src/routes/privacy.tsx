import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Shield, Lock, Eye, FileText } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-black text-white px-6 py-12">
      <div className="max-w-3xl mx-auto space-y-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-white transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
        </Link>

        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Privacy Policy</h1>
          <p className="text-xs text-zinc-400 mt-2 font-mono">Last updated: October 2026</p>
        </div>

        <div className="space-y-6 text-sm text-zinc-300 leading-relaxed pt-2">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">1. Information We Collect</h2>
            <p>
              We collect information you provide directly to us when using PhantmOS, including your resume details, contact information, target job roles, and application history.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">2. How We Use Your Information</h2>
            <p>
              Your data is exclusively utilized to:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-zinc-400 text-xs">
              <li>Discover and score relevant job listings based on your skills.</li>
              <li>Tailor resume bullet points and generate targeted application drafts.</li>
              <li>Track and manage your hiring pipeline.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">3. Data Security and Retention</h2>
            <p>
              We implement industry-standard encryption protocols to protect your personal information. Your profile and application data are never sold to third-party data brokers.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">4. Your Data Rights</h2>
            <p>
              You have the right to request access, correction, or deletion of your stored profile data at any time through your account settings or by contacting our support team.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
