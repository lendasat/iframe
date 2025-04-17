import { Link, useLocation } from "react-router-dom";
import {
  ChevronDown,
  File,
  Signature,
  CreditCard,
  LogOut,
  HomeIcon,
  User,
  Wallet,
  Bell,
  MessageCircle,
  Code,
} from "lucide-react";
import Lendasat from "../../assets/lendasat-icon.png";
import {
  Switch,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@frontend/shadcn";
import { NavMain } from "./nav-main";
import { getPreferredTheme, useTheme } from "@frontend/ui-shared";

const lowMenuItems = [
  {
    title: "Contracts",
    url: "/my-contracts",
    icon: Signature,
  },
  {
    title: "Cards",
    url: "/cards",
    icon: CreditCard,
  },
];

interface AppSidebarProps {
  username: string;
  onLogout: () => void;
}

const ThemeSwitch = () => {
  const { toggleTheme } = useTheme();

  const checked = getPreferredTheme() === "dark";

  return (
    <div className="flex items-center space-x-2 px-2 py-1">
      <Switch
        className="h-2.5 w-4"
        thumbClassName="h-1.5 w-1.5 ml-0.5 data-[state=checked]:translate-x-[calc(100%)] data-[state=unchecked]:translate-x-0"
        id="dark-mode"
        checked={checked}
        onCheckedChange={toggleTheme}
      />
      <span className="text-sm">Dark mode (beta)</span>
    </div>
  );
};

// TODOs:
// - Lendasat logo shifts slightly when collapsing sidebar.
// - Lendasat logo clickable area is weird when sidebar is collapsed.
// - Username transition animation is bad.
// - Dark mode is ugly and does not apply to desktop sidebar.
export function AppSidebar({ onLogout, username }: AppSidebarProps) {
  const location = useLocation();
  console.log(`${location.pathname}`);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton className="w-auto hover:bg-gray-200 group-data-[collapsible=icon]:px-1">
                <img
                  src={Lendasat}
                  alt="Logo"
                  className="h-6 w-auto px-0 dark:invert"
                />
                <span className="text-base font-semibold group-data-[collapsible=icon]:hidden">
                  {username}
                </span>
                <div className="ml-auto group-data-[collapsible=icon]:hidden">
                  <ChevronDown className="" />
                </div>
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              className="w-[--radix-popper-anchor-width]"
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel>Settings</DropdownMenuLabel>
                <Link to="/settings/profile">
                  <DropdownMenuItem className="cursor-pointer">
                    <User />
                    <span>Profile</span>
                  </DropdownMenuItem>
                </Link>
                <Link to="/settings/wallet">
                  <DropdownMenuItem className="cursor-pointer">
                    <Wallet />
                    <span>Wallet</span>
                  </DropdownMenuItem>
                </Link>
                <Link to="/settings/notifications">
                  <DropdownMenuItem className="cursor-pointer">
                    <Bell />
                    <span>Notifications</span>
                  </DropdownMenuItem>
                </Link>
                <Link to="/settings/chat">
                  <DropdownMenuItem className="cursor-pointer">
                    <MessageCircle />
                    <span>Nostr chat</span>
                  </DropdownMenuItem>
                </Link>
                <Link to="/settings/version">
                  <DropdownMenuItem className="cursor-pointer">
                    <Code />
                    <span>Version</span>
                  </DropdownMenuItem>
                </Link>
                <ThemeSwitch />
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer" onClick={onLogout}>
                <LogOut />
                <span>Log out</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Legal</DropdownMenuLabel>
                <Link to="https://tos.lendasat.com/">
                  <DropdownMenuItem className="cursor-pointer">
                    <File />
                    <span>Terms of service</span>
                  </DropdownMenuItem>
                </Link>
                <Link to="https://lendasat.notion.site/Privacy-a91b9883bca1495693654c996f5423e1?pvs=25">
                  <DropdownMenuItem className="cursor-pointer">
                    <File />
                    <span>Privacy policy</span>
                  </DropdownMenuItem>
                </Link>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <SidebarMenuItem></SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem className="hover:bg-gray-200" key="home">
                <SidebarMenuButton asChild>
                  <Link to="/">
                    <HomeIcon />
                    <span>Home</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <NavMain />

        {lowMenuItems.map((item) => (
          <SidebarGroup key={item.title}>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem className="hover:bg-gray-200" key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <div className="flex justify-end">
          <SidebarTrigger />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
