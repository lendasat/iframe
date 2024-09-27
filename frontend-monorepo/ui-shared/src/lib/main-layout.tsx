import { faBars } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Version } from "@frontend-monorepo/base-http-client";
import { useAuth } from "@frontend-monorepo/http-client-borrower";
import { Avatar, Box, Flex } from "@radix-ui/themes";
import React, { ReactNode } from "react";
import { IconType } from "react-icons";
import { IoNotifications } from "react-icons/io5";
import { RiCustomerService2Fill } from "react-icons/ri";
import { TbLogout } from "react-icons/tb";
import { Menu, MenuItem, Sidebar } from "react-pro-sidebar";
import { Link, NavLink } from "react-router-dom";
import { SidebarFooter } from "./components/SidebarFooter";
import { SidebarHeader } from "./components/SidebarHeader";

type Theme = "light" | "dark";

interface MenuItem {
  label: string;
  icon: IconType;
  path: string;
  target?: string;
}

interface LayoutProps {
  children: ReactNode;
  menuItems: MenuItem[];
  theme?: Theme;
  backendVersion: Version;
}

export const Layout: React.FC<LayoutProps> = ({ children, menuItems, theme = "light", backendVersion }) => {
  const [toggled, setToggled] = React.useState(false);
  const [broken, setBroken] = React.useState(false);
  const layout = window;
  const { user } = useAuth();

  return (
    <div
      className="bg-dashboard h-screen overflow-hidden"
      style={{ display: "flex", height: "100%" }}
    >
      <Sidebar
        toggled={toggled}
        onBackdropClick={() => setToggled(false)}
        onBreakPoint={setBroken}
        breakPoint="lg"
        rootStyles={{
          height: "100vh !important",
          borderWidth: 0,
        }}
      >
        <div className="flex flex-col h-full px-3 pt-10 pb-2 items-center bg-dashboard">
          <SidebarHeader style={{ margin: "auto" }} />
          <div className="flex-1 w-full">
            <Menu className="mt-12">
              {menuItems.map((item, index) => (
                <MenuItem
                  key={index}
                  className="hover:bg-none"
                  id="navLink"
                  component={
                    <NavLink
                      className="px-1 h-auto text-font text-base rounded-xl font-medium py-1.5 aria-[current=page]:bg-active-nav mb-1"
                      to={item.path}
                      target={item.target ? item.target : "_self"}
                      rel="noopener noreferrer"
                    />
                  }
                  icon={<item.icon className="text-lg -mr-4" />}
                >
                  {item.label}
                </MenuItem>
              ))}
            </Menu>
          </div>

          <Link
            className="flex items-center gap-2 px-1 h-auto text-font text-base rounded-lg font-medium py-1.5 no-underline"
            to={"/logout"}
          >
            <TbLogout />
            <span>Log Out</span>
          </Link>
          <SidebarFooter backendVersion={backendVersion} />
        </div>
      </Sidebar>

      <main className="w-full h-screen overflow-hidden relative">
        <Box className="h-[60px] px-6 md:px-8 flex items-center justify-between">
          <Box>
            <Flex>
              {broken && (
                <div className="flex items-center justify-between md:px-10 px-4">
                  <button className="sb-button" onClick={() => setToggled(!toggled)}>
                    <FontAwesomeIcon icon={faBars} />
                  </button>
                </div>
              )}
            </Flex>
          </Box>
          <Box>
            <Flex align={"center"} className="gap-4 md:gap-8">
              <Link to={"https://lendasat.notion.site"} target="_blank">
                <RiCustomerService2Fill size={"20"} />
              </Link>
              <Link to={"/history"}>
                <IoNotifications size={"20"} />
              </Link>
              <Link to={"/my-account"}>
                <Avatar
                  size={"3"}
                  radius="full"
                  color="purple"
                  fallback={user ? user.name.substring(0, 1) : "U"}
                />
              </Link>
            </Flex>
          </Box>
        </Box>
        <Box
          className="bg-gradient-to-br from-active-nav/5 from-40% via-70% via-purple/800/5 to-100% to-[#1a56e30b] lg:rounded-tl-2xl"
          style={{
            height: layout.innerHeight - 60,
          }}
        >
          {children}
        </Box>
      </main>
    </div>
  );
};
