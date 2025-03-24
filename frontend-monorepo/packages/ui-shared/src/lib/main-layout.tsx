import type { Version } from "@frontend/base-http-client";
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

interface IMenuItem {
  group: GroupProps[];
  separator?: boolean;
}

interface LayoutProps {
  user: User;
  children: ReactNode;
  menuItems: IMenuItem[];
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
        <div className="dark:from-dark dark:via-dark/100 dark:to-dark/80 flex h-full flex-col items-center border-l border-black/5 bg-gradient-to-b from-blue-500/[2%] via-pink-500/5 via-40% to-[#FBFAF8] to-90% pb-3 dark:border-white/10">
          <Box
            className={`flex w-full items-center ${
              collapsed ? "justify-center" : "justify-between"
            } h-20 px-3`}
          >
            <SidebarHeader
              className={`shrink-0 ${collapsed ? "hidden" : "flex"} ml-5`}
            />
            <IconButton
              variant={"ghost"}
              color="gray"
              className="hidden hover:bg-transparent lg:block"
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
                key={items.group.map((g) => g.label).join("-")}
                className={index === 0 ? "px-3" : "px-3 pt-[5vh]"}
              >
                {items.group.map((item) => {
                  if (!item.visible) {
                    return "";
                  }

                  return (
                    <MenuItem
                      key={`${item.label}_${item.path}_${item.borrower}`}
                      component={
                        <NavLink
                          className={
                            "dark:aria-[current=page]:bg-dark/65 dark:aria-[current=page]:border-dark/95 aria-[current=page]:text-font dark:aria-[current=page]:text-font-dark text-font/90 dark:text-font-dark/90 capitalize aria-[current=page]:border aria-[current=page]:border-white/95 aria-[current=page]:bg-white/65 aria-[current=page]:font-medium aria-[current=page]:shadow-sm aria-[current=page]:backdrop-blur-md"
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
                    className="mt-[5vh] opacity-40"
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
              <Box className="dark:bg-dark/90 flex h-14 w-full flex-row items-center justify-between rounded-xl bg-white/90 p-3 shadow-sm dark:shadow-md">
                <Flex align={"center"} gap={"2"}>
                  <Box className="relative">
                    <Avatar
                      color="purple"
                      size={"2"}
                      radius="full"
                      fallback={user ? user.name.substring(0, 1) : "W"}
                    />
                    {user?.verified ? (
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
                        "text-font dark:text-font-dark break-keep capitalize"
                      }
                    >
                      {user.name}
                    </Text>
                    <Text
                      weight={"medium"}
                      className="text-font/80 dark:text-font-dark/80 break-keep text-[9px]"
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

      <main className="dark:from-dark dark:to-dark relative flex h-screen w-full flex-col overflow-hidden bg-gradient-to-tr from-[#FBFAF8] to-pink-700/5">
        {/* Header */}
        <Box className="dark:border-dark dark:bg-dark flex h-[65px] items-center justify-between gap-10 border-b border-black/5 px-5 md:px-8">
          <Box className="shrink-0">
            <Flex align={"center"} gap={"5"}>
              {broken && (
                <IconButton
                  variant={"ghost"}
                  color="gray"
                  className="block hover:bg-transparent lg:hidden"
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
                    className="text-font/90 dark:text-font-dark/90 -mt-1 font-semibold capitalize"
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
                className="text-font/80 hover:text-font flex h-9 w-9 items-center justify-center rounded-full border border-white bg-white/70 transition-colors duration-200 ease-in hover:border-black/10 hover:bg-white"
                to={"https://lendasat.notion.site"}
                target="_blank"
              >
                <IoHelpCircleOutline size={"20"} />
              </Link>
              <Link
                className="text-font/80 hover:text-font flex h-9 w-9 items-center justify-center rounded-full border border-white bg-white/70 transition-colors duration-200 ease-in hover:border-black/10 hover:bg-white"
                to={"/"}
              >
                <IoIosNotificationsOutline size={"20"} />
              </Link>
              <ThemeSwitch className="text-font/80 hover:text-font flex h-9 w-9 items-center justify-center rounded-full border border-white bg-white/70 transition-colors duration-200 ease-in hover:border-black/10 hover:bg-white" />
            </Flex>
          </Box>
        </Box>

        {/* Content */}
        <Box className="dark:bg-dark flex-1 lg:rounded-tl-2xl">{children}</Box>

        {/* Footer */}
        <Box className="dark:bg-dark flex flex-wrap items-center justify-center gap-3 px-4 pb-2 md:justify-end md:px-6">
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
              className="text-font/70 dark:text-font-dark/70 flex items-center gap-1 no-underline"
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
              className="text-font/70 dark:text-font-dark/70 flex items-center gap-1 no-underline"
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
              className="text-font/70 dark:text-font-dark/70 flex items-center gap-1 no-underline"
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
