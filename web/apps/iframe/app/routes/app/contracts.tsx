import { useOutletContext } from "react-router";
import type { Route } from "../+types/app";
import { ContractsTab } from "~/components/ContractsTab";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Contracts - Lendasat" },
    { name: "description", content: "View your loan contracts" },
  ];
}

export default function Contracts() {
  const { user } = useOutletContext<{
    user: { email: string; username: string };
  }>();

  return <ContractsTab user={user} />;
}
