import {
  BookUser,
  ChevronRight,
  FilePlus2,
  Library,
  ScrollText,
  Search,
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
    url: "/my-offers",
    icon: ScrollText,
    isActive: true,
    items: [
      {
        icon: FilePlus2,
        title: "Create Offer",
        url: "/create-loan-offer",
        isActive: false,
      },
      {
        icon: BookUser,
        title: "My Offers",
        url: "/my-offers",
        isActive: false,
      },
      {
        icon: Library,
        title: "All Offers",
        url: "/offers",
        isActive: false,
      },
      {
        icon: Search,
        title: "Open Applications",
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
                <Link to="/my-offers">
                  <ScrollText />
                  <span>Offers</span>
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
                <item.icon className={"h-4 w-4 mr-2"} />
                <span>{item.title}</span>{" "}
                <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenuSub>
                  {item.items.map((item) => (
                    <SidebarMenuSubItem
                      key={item.title}
                      className={"hover:bg-gray-200"}
                    >
                      <SidebarMenuSubButton
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
