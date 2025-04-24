import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  Tabs,
  TabsList,
  TabsTrigger,
  ScrollArea,
  ScrollBar,
} from "@frontend/shadcn";
import { Profile } from "./profile";
import { Wallet } from "./wallet";
import { NostrChatSettingsPage } from "./nostr-chat-settings";
import { NotificationSettings } from "./notification-settings";
import { VersionPage } from "./version-page";

function Settings() {
  const location = useLocation();
  const currentPath = location.pathname.split("/").pop();

  return (
    <div className="bg-white px-6 py-6 dark:bg-black">
      <Card>
        <CardHeader className="border-b px-6 py-4">
          <Tabs value={currentPath || "profile"} className="w-full">
            <ScrollArea>
              <TabsList className="w-full justify-start">
                <TabsTrigger value="profile" asChild>
                  <Link to="profile">Profile</Link>
                </TabsTrigger>
                <TabsTrigger value="wallet" asChild>
                  <Link to="wallet">Wallet</Link>
                </TabsTrigger>
                <TabsTrigger value="notifications" asChild>
                  <Link to="notifications">Notifications</Link>
                </TabsTrigger>
                <TabsTrigger value="chat" asChild>
                  <Link to="chat">Chat</Link>
                </TabsTrigger>
                <TabsTrigger value="version" asChild>
                  <Link to="version">Version</Link>
                </TabsTrigger>
              </TabsList>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </Tabs>
        </CardHeader>

        <ScrollArea className="bg-white px-6 py-6 dark:bg-black w-full">
          <CardContent className="p-6 h-[70vh]">
            <Routes>
              <Route path="/" element={<Navigate to="profile" replace />} />
              <Route path="profile" element={<Profile />} />
              <Route path="wallet" element={<Wallet />} />
              <Route path="notifications" element={<NotificationSettings />} />
              <Route path="chat" element={<NostrChatSettingsPage />} />
              <Route path="version" element={<VersionPage />} />
            </Routes>
          </CardContent>
          <ScrollBar />
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </Card>
    </div>
  );
}

export default Settings;
