import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/job_discovery")({
  beforeLoad: () => {
    throw redirect({ to: "/job-discovery" });
  },
});
