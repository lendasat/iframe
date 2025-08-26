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
import { IntegrationSettings } from "./integration-settings";
import SecuritySettings from "./security";
import { FeatureFlagProtectedRoute } from "../app";
import { LoanProductOption } from "@frontend/http-client-borrower";

function Settings() {
  const location = useLocation();
  const currentPath = location.pathname.split("/").pop();

  return (
    <div className="px-6 py-6">
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
                <TabsTrigger value="integrations" asChild>
                  <Link to="integrations">Integrations</Link>
                </TabsTrigger>
                <TabsTrigger value="security" asChild>
                  <Link to="security">Security</Link>
                </TabsTrigger>
                <TabsTrigger value="version" asChild>
                  <Link to="version">Version</Link>
                </TabsTrigger>
              </TabsList>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </Tabs>
        </CardHeader>

        <ScrollArea className="w-full px-6 py-6">
          <CardContent className="h-[70vh]">
            <Routes>
              <Route path="/" element={<Navigate to="profile" replace />} />
              <Route path="profile" element={<Profile />} />
              <Route path="wallet" element={<Wallet />} />
              <Route path="notifications" element={<NotificationSettings />} />
              <Route path="chat" element={<NostrChatSettingsPage />} />
              <Route
                path="integrations"
                element={
                  <FeatureFlagProtectedRoute
                    neededFeature={LoanProductOption.Bringin}
                  >
                    <IntegrationSettings />
                  </FeatureFlagProtectedRoute>
                }
              />
              <Route path="security" element={<SecuritySettings />} />
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
