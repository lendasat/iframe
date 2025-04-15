import { SidebarProvider, SidebarTrigger, useSidebar } from "@frontend/shadcn";
import { AppSidebar } from "./sidebar/app-sidebar";
import type { Version } from "@frontend/base-http-client";
import { Box } from "@radix-ui/themes";
import type { ReactNode } from "react";
import type { FC } from "react";
import type { IconType } from "react-icons";

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

interface AppProps {
  children: ReactNode;
}

export interface User {
  name: string;
  email: string;
  verified: boolean;
}

const App = ({ children }: AppProps) => {
  const { isMobile } = useSidebar();

  return (
    <>
      <main className="dark:from-dark dark:to-dark relative flex h-screen w-full flex-col overflow-hidden bg-gradient-to-tr from-[#FBFAF8] to-pink-700/5">
        <Box className="dark:bg-dark flex-1 lg:rounded-tl-2xl">
          {isMobile ? (
            <div className="mt-0 flex flex-col gap-2 p-0 p-2">
              <SidebarTrigger />
            </div>
          ) : null}
          {children}
        </Box>
      </main>
    </>
  );
};

export const Layout: FC<LayoutProps> = ({ children, user, logout }) => {
  return (
    <div
      className="bg-dashboard h-screen overflow-hidden"
      style={{ display: "flex", height: "100%" }}
    >
      <SidebarProvider>
        <AppSidebar onLogout={logout} username={user.name} />
        <App children={children} />
      </SidebarProvider>
    </div>
  );
};
