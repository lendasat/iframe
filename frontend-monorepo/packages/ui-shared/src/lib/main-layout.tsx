import type { Version } from "@frontend-monorepo/base-http-client";
import {
  Avatar,
  Box,
  Flex,
  Heading,
  IconButton,
  Separator,
  Text,
} from "@radix-ui/themes";
import type { ReactNode } from "react";
import type { FC } from "react";
import { useState } from "react";
import type { IconType } from "react-icons";
import { IoIosNotificationsOutline } from "react-icons/io";
import { IoChevronForward, IoHelpCircleOutline } from "react-icons/io5";
import { PiCopyright } from "react-icons/pi";
import { RiVerifiedBadgeFill } from "react-icons/ri";
import { TbLayoutSidebarLeftCollapse } from "react-icons/tb";
import { Menu, MenuItem, Sidebar } from "react-pro-sidebar";
import { Link, NavLink } from "react-router-dom";
import Logout from "./components/Logout";
import { SidebarHeader } from "./components/SidebarHeader";
import ThemeSwitch from "./components/theme-switch";

interface GroupProps {
  label: string;
  icon: IconType;
  path: string;
  target?: string;
  borrower?: boolean;
  visible: boolean;
}

interface MenuItem {
  group: GroupProps[];
  separator?: boolean;
}

interface LayoutProps {
  user: User;
  children: ReactNode;
  menuItems: MenuItem[];
  backendVersion: Version;
  logout: () => Promise<void>;
}

export interface User {
  name: string;
  email: string;
  verified: boolean;
}

export const Layout: FC<LayoutProps> = ({
  children,
  menuItems,
  backendVersion,
  user,
  logout,
}) => {
  const versionString = `${
    backendVersion.version
  }-${backendVersion.commit_hash.substring(0, 5)}`;
  const [toggled, setToggled] = useState(false);
  const [broken, setBroken] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className="bg-dashboard h-screen overflow-hidden"
      style={{ display: "flex", height: "100%" }}
    >
      <Sidebar
        toggled={toggled}
        collapsed={collapsed}
        onBackdropClick={() => setToggled(false)}
        onBreakPoint={setBroken}
        breakPoint="lg"
        className={"dark:border-dark"}
        rootStyles={{
          height: "100vh !important",
        }}
      >
        <div className="flex flex-col h-full pb-3 items-center bg-gradient-to-b from-blue-500/[2%] via-40% via-pink-500/5 to-[#FBFAF8] to-90% dark:from-dark dark:via-dark/100 dark:to-dark/80 border-l border-black/5 dark:border-white/10">
          <Box
            className={`w-full flex items-center ${
              collapsed ? "justify-center" : "justify-between"
            } px-3 h-20`}
          >
            <SidebarHeader
              className={`shrink-0 ${collapsed ? "hidden" : "flex"} ml-5`}
            />
            <IconButton
              variant={"ghost"}
              color="gray"
              className="hover:bg-transparent hidden lg:block"
              onClick={() => setCollapsed(!collapsed)}
            >
              <TbLayoutSidebarLeftCollapse size={20} />
            </IconButton>
          </Box>
          <Menu
            style={{
              height: "100%",
              width: "100%",
            }}
            menuItemStyles={{
              button: () => {
                return {
                  paddingLeft: "9px",
                  paddingRight: "9px",
                  borderRadius: 12,
                  height: "45px",
                  ":hover": {
                    backgroundColor: "transparent",
                  },
                };
              },
              icon: {
                marginRight: 0,
              },
              label: {
                fontSize: 14,
              },
            }}
          >
            {menuItems.map((items, index) => (
              <Box
                key={index}
                className={index === 0 ? "px-3" : "px-3 pt-[5vh]"}
              >
                {items.group.map((item, idx) => {
                  if (!item.visible) {
                    return "";
                  }

                  return (
                    <MenuItem
                      key={idx}
                      component={
                        <NavLink
                          className={
                            "aria-[current=page]:bg-white/65 dark:aria-[current=page]:bg-dark/65 aria-[current=page]:border aria-[current=page]:border-white/95 dark:aria-[current=page]:border-dark/95 aria-[current=page]:text-font dark:aria-[current=page]:text-font-dark aria-[current=page]:font-medium aria-[current=page]:backdrop-blur-md aria-[current=page]:shadow-sm capitalize text-font/90 dark:text-font-dark/90"
                          }
                          to={item.path}
                          target={item.target ? item.target : "_self"}
                        />
                      }
                      icon={<item.icon size={18} />}
                    >
                      {item.label}
                    </MenuItem>
                  );
                })}
                {items.separator && (
                  <Separator
                    size={"4"}
                    color="gray"
                    className="opacity-40 mt-[5vh]"
                  />
                )}
              </Box>
            ))}
            <Box className="px-3">
              <Logout logout={logout} />
            </Box>
          </Menu>
          {user && (
            <Link to={"setting"} className="w-full px-3">
              <Box className="h-14 shadow-sm w-full bg-white/90 dark:bg-dark/90 rounded-xl p-3 flex flex-row items-center justify-between dark:shadow-md">
                <Flex align={"center"} gap={"2"}>
                  <Box className="relative">
                    <Avatar
                      color="purple"
                      size={"2"}
                      radius="full"
                      fallback={user ? user.name.substring(0, 1) : "W"}
                    />
                    {user && user.verified ? (
                      <RiVerifiedBadgeFill
                        color="green"
                        className="absolute bottom-0 right-0 z-10"
                        size={10}
                      />
                    ) : (
                      ""
                    )}
                  </Box>
                  <Flex
                    direction={"column"}
                    className={
                      collapsed
                        ? "opacity-0"
                        : "shrink-0 opacity-100 transition-opacity duration-200 ease-in"
                    }
                  >
                    <Text
                      size={"2"}
                      weight={"medium"}
                      className={
                        "capitalize text-font dark:text-font-dark break-keep"
                      }
                    >
                      {user.name}
                    </Text>
                    <Text
                      weight={"medium"}
                      className="text-[9px] text-font/80 dark:text-font-dark/80 break-keep"
                    >
                      {user.email}
                    </Text>
                  </Flex>
                </Flex>
                <IoChevronForward
                  size={15}
                  className={collapsed ? "hidden" : "flex"}
                />
              </Box>
            </Link>
          )}
        </div>
      </Sidebar>

      <main className="w-full h-screen flex flex-col overflow-hidden relative bg-gradient-to-tr from-[#FBFAF8] to-pink-700/5 dark:from-dark dark:to-dark">
        {/* Header */}
        <Box className="h-[65px] px-5 md:px-8 flex items-center justify-between gap-10 border-b border-black/5 dark:border-dark dark:bg-dark">
          <Box className="shrink-0">
            <Flex align={"center"} gap={"5"}>
              {broken && (
                <IconButton
                  variant={"ghost"}
                  color="gray"
                  className="hover:bg-transparent block lg:hidden"
                  onClick={() => setToggled(!toggled)}
                >
                  <TbLayoutSidebarLeftCollapse size={20} />
                </IconButton>
              )}
              {user && (
                <Box>
                  <Text
                    className="text-font dark:text-font-dark"
                    weight={"medium"}
                    size={"1"}
                  >
                    Welcome,
                  </Text>
                  <Heading
                    className="capitalize text-font/90 dark:text-font-dark/90 -mt-1 font-semibold"
                    size={"3"}
                  >
                    {user.name}
                  </Heading>
                </Box>
              )}
            </Flex>
          </Box>

          {/*TODO: removed for now due to not being implemented
          <SearchBar placeholder="Looking for something..." />*/}

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
                to={"/"}
              >
                <IoIosNotificationsOutline size={"20"} />
              </Link>
              <ThemeSwitch className="h-9 w-9 bg-white/70 text-font/80 border border-white rounded-full flex items-center justify-center  hover:bg-white hover:border-black/10 hover:text-font transition-colors ease-in duration-200" />
            </Flex>
          </Box>
        </Box>

        {/* Content */}
        <Box className="lg:rounded-tl-2xl flex-1 dark:bg-dark">{children}</Box>

        {/* Footer */}
        <Box className="flex md:justify-end gap-3 items-center px-4 md:px-6 flex-wrap justify-center dark:bg-dark pb-2">
          <Text
            as="p"
            size={"1"}
            weight={"medium"}
            className="text-font/70 dark:text-font-dark/70 tracking-wider"
          >
            {versionString}
          </Text>
          <Box className="flex flex-row items-center gap-2">
            <Link
              to={"/"}
              className="flex items-center gap-1 text-font/70 dark:text-font-dark/70 no-underline"
            >
              <PiCopyright />
              <Text as="p" size={"1"} weight={"medium"}>
                {new Date().getFullYear()} Lendasat
              </Text>
            </Link>
            <Text as="span" color="gray">
              •
            </Text>
            <Link
              to={"https://tos.lendasat.com/"}
              className="flex items-center gap-1 text-font/70 dark:text-font-dark/70 no-underline"
            >
              <Text as="p" size={"1"} weight={"medium"}>
                Terms of Service
              </Text>
            </Link>
            <Text as="span" color="gray">
              •
            </Text>
            <Link
              to={
                "https://lendasat.notion.site/Privacy-a91b9883bca1495693654c996f5423e1?pvs=25"
              }
              className="flex items-center gap-1 text-font/70 dark:text-font-dark/70 no-underline"
            >
              <Text as="p" size={"1"} weight={"medium"}>
                Privacy Policy
              </Text>
            </Link>
          </Box>
        </Box>
      </main>
    </div>
  );
};
