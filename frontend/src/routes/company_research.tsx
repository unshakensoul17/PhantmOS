import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/company_research")({
  beforeLoad: () => {
    throw redirect({ to: "/company-research" });
  },
});
