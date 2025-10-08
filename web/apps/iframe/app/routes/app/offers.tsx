import { useOutletContext } from "react-router";
import type { Route } from "../+types/app";
import { OffersTab } from "~/components/OffersTab";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Offers - Lendasat" },
    { name: "description", content: "Browse available loan offers" },
  ];
}

export default function Offers() {
  const { user } = useOutletContext<{
    user: { email: string; username: string };
  }>();

  return <OffersTab user={user} />;
}
