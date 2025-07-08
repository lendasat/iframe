import {
  ChevronRight,
  FileSpreadsheet,
  Library,
  Mails,
  ScrollText,
  Search,
  Send,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@frontend/shadcn";

const loanNavItems = [
  {
    title: "Offers",
    url: "#",
    icon: ScrollText,
    isActive: true,
    items: [
      {
        icon: Search,
        title: "Find Offer",
        url: "/requests",
        isActive: false,
      },
      {
        icon: Library,
        title: "See All Offers",
        url: "/available-offers",
        isActive: false,
      },
    ],
  },
  {
    title: "Requests",
    url: "#",
    icon: FileSpreadsheet,
    isActive: true,
    items: [
      {
        icon: Send,
        title: "Apply",
        url: "/loan-application",
        isActive: false,
      },
      {
        icon: Mails,
        title: "My Requests",
        url: "/loan-applications",
        isActive: false,
      },
    ],
  },
];

export function NavMain() {
  const { state } = useSidebar();

  if (state === "collapsed") {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem className="hover:bg-gray-200" key="loans">
              <SidebarMenuButton asChild>
                <Link to="/requests">
                  <ScrollText />
                  <span>Loans</span>
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
        <Collapsible
          key={item.title}
          title={item.title}
          defaultOpen
          asChild
          className="group/collapsible"
        >
          <SidebarGroup>
            <SidebarGroupLabel
              asChild
              className="group/label text-sm hover:bg-gray-200"
            >
              <CollapsibleTrigger>
                <item.icon className={"mr-2 h-4 w-4"} />
                <span>{item.title}</span>{" "}
                <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenuSub>
                  {item.items.map((item) => (
                    <SidebarMenuSubItem key={item.title}>
                      <SidebarMenuSubButton
                        className="hover:bg-gray-200"
                        asChild
                        isActive={location.pathname.includes(item.url)}
                      >
                        <Link to={item.url}>
                          {item.icon && <item.icon />}
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
      ))}
    </>
  );
}
