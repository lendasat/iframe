import { faBars } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Version } from "@frontend-monorepo/base-http-client";
import React, { ReactNode } from "react";
import { IconType } from "react-icons";
import { IoNotifications } from "react-icons/io5";
import { RiCustomerService2Fill, RiUser6Fill } from "react-icons/ri";
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

      <main className="w-full h-screen">
        <div
          className="h-screen w-full bg-active-nav/5 overflow-hidden relative"
          style={{ color: "#44596e" }}
        >
          <div
            style={{ marginBottom: "16px" }}
          >
            {broken && (
              <div className="w-full py-3 flex items-center justify-between md:px-10 px-4">
                <button className="sb-button" onClick={() => setToggled(!toggled)}>
                  <FontAwesomeIcon icon={faBars} />
                </button>
                <div className="flex items-center gap-3">
                  <Link to={"/history"} className="h-10 w-10 border flex items-center justify-center rounded">
                    <IoNotifications className="text-xl text-font" />
                  </Link>
                  <Link
                    to={"https://lendasat.notion.site"}
                    className="h-10 w-10 border flex items-center justify-center rounded"
                    target="_blank"
                  >
                    <RiCustomerService2Fill className="text-xl text-font" />
                  </Link>
                  <Link to={"/my-account"} className="no-underline">
                    <div className="h-10 w-10 md:border-0 border flex items-center justify-center rounded text-font">
                      <RiUser6Fill />
                    </div>
                  </Link>
                </div>
              </div>
            )}
          </div>
          <div className="h-full lg:px-12 md:px-8 px-4 ">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};
