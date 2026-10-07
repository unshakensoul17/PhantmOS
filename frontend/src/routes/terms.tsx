import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/terms")({
  component: TermsAndConditionsPage,
});

function TermsAndConditionsPage() {
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
          <h1 className="text-3xl font-bold tracking-tight text-white">Terms and Conditions</h1>
          <p className="text-xs text-zinc-400 mt-2 font-mono">Last updated: October 2026</p>
        </div>

        <div className="space-y-6 text-sm text-zinc-300 leading-relaxed pt-2">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">1. Acceptance of Terms</h2>
            <p>
              By accessing or using PhantmOS, you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use the service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">2. Permitted Use</h2>
            <p>
              PhantmOS is provided for personal career advancement and job application management. You agree to use the platform in compliance with all applicable local, national, and international laws.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">3. User Responsibility</h2>
            <p>
              You are responsible for reviewing and verifying all tailored resumes, applications, and communications before submitting them to potential employers.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">4. Limitation of Liability</h2>
            <p>
              PhantmOS provides job discovery and application preparation tools as-is. We do not guarantee specific employment outcomes, interview offers, or hiring decisions.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
