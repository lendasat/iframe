import { Link } from "react-router-dom";
import {
  ChevronDown,
  File,
  Signature,
  LogOut,
  HomeIcon,
  Settings2,
  User,
  Wallet,
  Bell,
  MessageCircle,
  Code,
  MoreHorizontal,
} from "lucide-react";
import { ReactComponent as Lendasat } from "../../assets/lendasat_black.svg";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarMenuAction,
  useSidebar,
} from "@frontend/shadcn";
import { NavMain } from "./nav-main";

const lowMenuItems = [
  {
    title: "Contracts",
    url: "/my-contracts",
    icon: Signature,
    items: [],
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings2,
    isActive: true,
    items: [
      {
        icon: User,
        name: "Profile",
        url: "/settings/profile",
        isActive: false,
      },
      {
        icon: Wallet,
        name: "Wallet",
        url: "/settings/wallet",
        isActive: false,
      },
      {
        icon: Bell,
        name: "Notifications",
        url: "/settings/notifications",
        isActive: false,
      },
      {
        icon: MessageCircle,
        name: "Nostr chat",
        url: "/settings/chat",
        isActive: false,
      },
      {
        icon: Code,
        name: "Version",
        url: "/settings/version",
        isActive: false,
      },
    ],
  },
];

interface AppSidebarProps {
  username: string;
  onLogout: () => void;
}

// TODOs:
// - Lendasat logo clickable area is weird when sidebar is collapsed.
// - Username transition animation is bad.
// - Dark mode is ugly and does not apply to desktop sidebar.
export function AppSidebar({ onLogout, username }: AppSidebarProps) {
  const { isMobile } = useSidebar();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton className="w-auto hover:bg-gray-200 group-data-[collapsible=icon]:px-1 [&>svg]:size-6">
                <Lendasat />
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
                  {item.items.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuAction showOnHover>
                          <MoreHorizontal />
                          <span className="sr-only">More</span>
                        </SidebarMenuAction>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        className="w-48"
                        side={isMobile ? "bottom" : "right"}
                        align={isMobile ? "end" : "start"}
                      >
                        {item.items.map((innerItem) => (
                          <Link to={innerItem.url}>
                            <DropdownMenuItem>
                              <innerItem.icon className="text-muted-foreground" />
                              <span>{innerItem.name}</span>
                            </DropdownMenuItem>
                          </Link>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
