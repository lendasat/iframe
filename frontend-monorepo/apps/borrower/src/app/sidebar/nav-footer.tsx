import {
  Bell,
  ChevronRight,
  Code,
  Folder,
  Library,
  LogOut,
  Mails,
  MessageCircle,
  MoreHorizontal,
  ScrollText,
  Search,
  Send,
  Settings2,
  Share,
  Trash2,
  User,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@frontend/shadcn";
import { LuLogOut } from "react-icons/lu";

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
      {loanNavItems.map((item) => (
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
                        <Link to={innerItem.url}>
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
      ))}
    </>
  );
}
