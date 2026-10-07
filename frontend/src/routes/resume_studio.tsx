import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/resume_studio")({
  beforeLoad: () => {
    throw redirect({ to: "/resume-studio" });
  },
});
