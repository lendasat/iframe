import {
  Bell,
  Code,
  MessageCircle,
  MoreHorizontal,
  Settings2,
  User,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@frontend/shadcn";

const loanNavItems = [
  {
    name: "Settings",
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

export function NavFooter() {
  const { state, isMobile } = useSidebar();

  if (state === "collapsed") {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem className="hover:bg-gray-200" key="loans">
              <SidebarMenuButton asChild>
                <Link to="/settings">
                  <Settings2 />
                  <span>Settings</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <>
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarMenu>
          {loanNavItems.map((item) => (
            <SidebarMenuItem key={item.name}>
              <SidebarMenuButton asChild>
                <Link to={item.url}>
                  <item.icon />
                  <span>{item.name}</span>
                </Link>
              </SidebarMenuButton>
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
                    <Link to={innerItem.url} key={innerItem.name}>
                      <DropdownMenuItem>
                        <innerItem.icon className="text-muted-foreground" />
                        <span>{innerItem.name}</span>
                      </DropdownMenuItem>
                    </Link>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroup>
    </>
  );
}
