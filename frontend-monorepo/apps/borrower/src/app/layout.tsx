import { SidebarInset, SidebarProvider } from "@frontend/shadcn";
import { AppSidebar } from "./sidebar/app-sidebar";
import type { Version } from "@frontend/base-http-client";
import type { ReactNode } from "react";
import type { FC } from "react";
import type { IconType } from "react-icons";
import { SiteHeader } from "./sidebar/header";

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
  return (
    <>
      <main>
        <div className="flex-1 lg:rounded-tl-2xl">{children}</div>
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
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-2">
              <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                <App children={children} />
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
};
