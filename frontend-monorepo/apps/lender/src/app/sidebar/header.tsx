import { Separator, SidebarTrigger } from "@frontend/shadcn";
import { useLocation } from "react-router-dom";

export function SiteHeader() {
  const location = useLocation();

  let header = "Home";
  switch (location.pathname) {
    case "/requests":
      header = "Find Offer";
      break;
    case "/available-offers":
      header = "All Offers";
      break;
    case "/loan-application":
      header = "Apply for a Loan";
      break;
    case "/loan-applications":
      header = "My Applications";
      break;
    case "/my-contracts":
      header = "My Contracts";
      break;
    case "/cards":
      header = "My Cards";
      break;
    case "/settings/profile":
      header = "Settings - Profile";
      break;
    case "/settings/wallet":
      header = "Settings - Wallet";
      break;
    case "/settings/notifications":
      header = "Settings - Notifications";
      break;
    case "/settings/chat":
      header = "Settings - Nostr chat";
      break;
    case "/settings/version":
      header = "Settings - Version";
      break;
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
