import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/companies")({
  beforeLoad: () => {
    throw redirect({ to: "/company-research" });
  },
});
