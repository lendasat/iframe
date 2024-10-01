import { Version } from "@frontend-monorepo/base-http-client";
import { Avatar, Box, Flex, Heading, IconButton, Text } from "@radix-ui/themes";
import React, { ReactNode } from "react";
import { IconType } from "react-icons";
import { IoIosNotificationsOutline } from "react-icons/io";
import { IoChevronForward, IoHelpCircleOutline } from "react-icons/io5";
import { RiVerifiedBadgeFill } from "react-icons/ri";
import { TbLayoutSidebarLeftCollapse } from "react-icons/tb";
import { Menu, MenuItem, Sidebar } from "react-pro-sidebar";
import { Link, NavLink } from "react-router-dom";
import BorrowerMenu from "./components/BorrowerMenu";
import { SidebarHeader } from "./components/SidebarHeader";
import { SearchBar } from "./components/SearchBar";

type Theme = "light" | "dark";

interface MenuItem {
  label: string;
  icon: IconType;
  path: string;
  target?: string;
  borrower?: boolean;
  seperator?: true;
}

interface LayoutProps {
  user: any;
  children: ReactNode;
  menuItems: MenuItem[];
  theme?: Theme;
  backendVersion: Version;
}

export const Layout: React.FC<LayoutProps> = ({ children, menuItems, theme, backendVersion, user }) => {
  const [toggled, setToggled] = React.useState(false);
  const [broken, setBroken] = React.useState(false);
  const [collasped, setCollapsed] = React.useState(false);
  const layout = window;

  return (
    <div
      className="bg-dashboard h-screen overflow-hidden"
      style={{ display: "flex", height: "100%" }}
    >
      <Sidebar
        toggled={toggled}
        collapsed={collasped}
        onBackdropClick={() => setToggled(false)}
        onBreakPoint={setBroken}
        breakPoint="lg"
        rootStyles={{
          height: "100vh !important",
          backgroundColor: "#fff",
        }}
      >
        <div className="flex flex-col h-full pb-3 items-center bg-gradient-to-b from-blue-500/[2%] via-40% via-pink-500/5 to-[#FBFAF8] to-90% border-l border-black/5">
          <Box className={`w-full flex items-center ${collasped ? "justify-center" : "justify-between"} px-3 h-20`}>
            <SidebarHeader className={`shrink-0 ${collasped ? "hidden" : "flex"} ml-5`} />
            <IconButton
              variant={"ghost"}
              color="gray"
              className="hover:bg-transparent hidden lg:block"
              onClick={() => (setCollapsed(!collasped))}
            >
              <TbLayoutSidebarLeftCollapse size={20} />
            </IconButton>
          </Box>
          {menuItems[0].borrower ? <BorrowerMenu /> : (
            <Menu className="h-full w-full">
              {menuItems.map((item, index) => (
                <MenuItem
                  key={index}
                  className="hover:bg-transparent px-3"
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
          )}
          {user && (
            <Link to={"setting"} className="w-full px-3">
              <Box className="h-14 shadow-sm w-full bg-white/90 rounded-xl p-3 flex flex-row items-center justify-between">
                <Flex align={"center"} gap={"2"}>
                  <Box className="relative">
                    <Avatar
                      color="purple"
                      size={"2"}
                      radius="full"
                      fallback={user ? user.name.substring(0, 1) : "W"}
                    />
                    {user && user.verified
                      ? <RiVerifiedBadgeFill color="green" className="absolute bottom-0 right-0 z-10" size={10} />
                      : ""}
                  </Box>
                  <Flex
                    direction={"column"}
                    className={collasped ? "opacity-0" : "shrink-0 opacity-100 transition-opacity duration-200 ease-in"}
                  >
                    <Text size={"2"} weight={"medium"} className={"capitalize break-keep"}>
                      {user.name}
                    </Text>
                    <Text weight={"medium"} className={"text-[9px] text-font/80 break-keep"}>
                      {user.email}
                    </Text>
                  </Flex>
                </Flex>
                <IoChevronForward size={15} className={collasped ? "hidden" : "flex"} />
              </Box>
            </Link>
          )}
        </div>
      </Sidebar>

      <main className="w-full h-screen overflow-hidden relative bg-gradient-to-tr from-60% to-100% from-[#FBFAF8] to-pink-700/5">
        <Box className="h-[65px] px-5 md:px-8 flex items-center justify-between gap-10 border-b border-black/5">
          <Box className="shrink-0">
            <Flex align={"center"} gap={"5"}>
              {broken && (
                <IconButton
                  variant={"ghost"}
                  color="gray"
                  className="hover:bg-transparent block lg:hidden"
                  onClick={() => (setToggled(!toggled))}
                >
                  <TbLayoutSidebarLeftCollapse size={20} />
                </IconButton>
              )}
              {user && (
                <Box>
                  <Text className="text-font" weight={"medium"} size={"1"}>Welcome,</Text>
                  <Heading className="capitalize text-font-dark/90 -mt-1 font-semibold" size={"3"}>{user.name}</Heading>
                </Box>
              )}
            </Flex>
          </Box>

          <SearchBar placeholder="Looking for something..." />

          <Box className="shrink-0">
            <Flex align={"center"} className="gap-4">
              <Link
                className="h-9 w-9 bg-white/70 text-font/80 border border-white rounded-full flex items-center justify-center  hover:bg-white hover:border-black/10 hover:text-font transition-colors ease-in duration-200"
                to={"https://lendasat.notion.site"}
                target="_blank"
              >
                <IoHelpCircleOutline size={"20"} />
              </Link>
              <Link
                className="h-9 w-9 bg-white/70 text-font/80 border border-white rounded-full flex items-center justify-center  hover:bg-white hover:border-black/10 hover:text-font transition-colors ease-in duration-200"
                to={"/history"}
              >
                <IoIosNotificationsOutline size={"20"} />
              </Link>
            </Flex>
          </Box>
        </Box>
        <Box
          className="lg:rounded-tl-2xl"
          style={{
            height: layout.innerHeight - 65,
          }}
        >
          {children}
        </Box>
      </main>
    </div>
  );
};
