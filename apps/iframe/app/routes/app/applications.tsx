import { useOutletContext } from "react-router";
import type { Route } from "../+types/app";
import { ApplicationsTab } from "~/components/ApplicationsTab";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Applications - Lendasat" },
    { name: "description", content: "View your loan applications" },
  ];
}

export default function Applications() {
  const { user } = useOutletContext<{
    user: { email: string; username: string };
  }>();

  return <ApplicationsTab user={user} />;
}
