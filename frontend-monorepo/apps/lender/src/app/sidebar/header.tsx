import { Separator, SidebarTrigger } from "@frontend/shadcn";
import { useLocation } from "react-router-dom";

export function SiteHeader() {
  const location = useLocation();
  const path = location.pathname;

  let header = "Home";
  if (path === "/") {
    header = "Home";
  } else if (path.startsWith("/requests")) {
    header = "Find Offer";
  } else if (path.startsWith("/create-loan-offer")) {
    header = "Create Loan Offer";
  } else if (path.startsWith("/available-offers")) {
    header = "All Offers";
  } else if (path.startsWith("/my-offers")) {
    header = "Edit Loan";
  } else if (path.startsWith("/loan-application")) {
    header = "Apply for a Loan";
  } else if (path.startsWith("/loan-applications")) {
    header = "My Applications";
  } else if (path.startsWith("/my-contracts")) {
    header = "My Contracts";
  } else if (path.startsWith("/cards")) {
    header = "My Cards";
  } else if (path.startsWith("/settings/profile")) {
    header = "Settings - Profile";
  } else if (path.startsWith("/settings/wallet")) {
    header = "Settings - Wallet";
  } else if (path.startsWith("/settings/notifications")) {
    header = "Settings - Notifications";
  } else if (path.startsWith("/settings/chat")) {
    header = "Settings - Nostr chat";
  } else if (path.startsWith("/settings/version")) {
    header = "Settings - Version";
  }

  return (
    <header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{header}</h1>
      </div>
    </header>
  );
}
