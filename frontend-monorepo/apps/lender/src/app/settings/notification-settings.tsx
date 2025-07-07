import TelegramBotDetails from "./TelegramBotDetails";
import {
  LenderNotificationSettings,
  useAuth,
  useLenderHttpClient,
} from "@frontend/http-client-lender";
import { useAsyncRetry } from "react-use";
import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Alert,
  AlertDescription,
  AlertTitle,
  Checkbox,
  Label,
  Button,
  Skeleton,
} from "@frontend/shadcn";
import { LuLoader } from "react-icons/lu";

export function NotificationSettings() {
  const { user } = useAuth();
  const { getNotificationSettings, updateNotificationSettings } =
    useLenderHttpClient();

  const maybeBotUrl = import.meta.env.VITE_TELEGRAM_BOT_URL;
  const maybeBotName = import.meta.env.VITE_TELEGRAM_BOT_NAME;
  const maybePersonalTelegramToken = user?.personal_telegram_token;

  let error = false;
  if (!maybeBotUrl || !maybeBotName || !maybePersonalTelegramToken) {
    error = true;
  }

  const botUrl = maybeBotUrl || "";
  const botName = maybeBotName || "";
  const personalTelegramToken = maybePersonalTelegramToken || "";

  const {
    value: settings,
    loading: settingsLoading,
    error: settingsError,
    retry: settingsRetry,
  } = useAsyncRetry(async () => {
    return await getNotificationSettings();
  });

  const [localSettings, setLocalSettings] =
    useState<LenderNotificationSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Update local settings when remote settings change
  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  if (settingsError) {
    console.error("Failed loading notification settings", settingsError);
  }

  const handleSettingChange = (
    key: keyof LenderNotificationSettings,
    value: boolean,
  ) => {
    if (!localSettings) {
      return;
    }
    setLocalSettings({ ...localSettings, [key]: value });
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!localSettings) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      await updateNotificationSettings(localSettings);
      settingsRetry();
    } catch (error) {
      console.error("Failed to update notification settings", error);
      setSaveError("Failed to save notification settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges =
    localSettings &&
    settings &&
    JSON.stringify(localSettings) !== JSON.stringify(settings);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card className="shadow-sm">
        <CardHeader className="px-4 pb-1 pt-3">
          <div>
            <CardTitle className="text-sm font-semibold">Telegram</CardTitle>
            <CardDescription>
              Stay up to date on the status of your contracts with Telegram
              notifications.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="mt-4">
          {error ? (
            <Alert variant="warning">
              <AlertTitle>Woops!</AlertTitle>
              <AlertDescription>
                Telegram notifications are currently unavailable.
              </AlertDescription>
            </Alert>
          ) : (
            <TelegramBotDetails
              token={personalTelegramToken}
              botUrl={botUrl}
              botName={botName}
            />
          )}
        </CardContent>
      </Card>
      <Card className="shadow-sm">
        <CardHeader className="px-4 pb-1 pt-3">
          <div>
            <CardTitle className="text-sm font-semibold">Settings</CardTitle>
            <CardDescription />
          </div>
        </CardHeader>
        <CardContent className="mt-4">
          {settingsLoading ? (
            <div className="flex flex-col gap-6">
              <div>
                <Skeleton className="mb-2 h-4 w-32" />
                <Skeleton className="mb-4 h-3 w-48" />
                <div className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              </div>
              <div>
                <Skeleton className="mb-2 h-4 w-40" />
                <Skeleton className="mb-4 h-3 w-56" />
                <div className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              </div>
              <div>
                <Skeleton className="mb-2 h-4 w-36" />
                <Skeleton className="mb-4 h-3 w-52" />
                <div className="space-y-3">
                  <div>
                    <Skeleton className="mb-2 h-3 w-24" />
                    <div className="flex gap-6">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-4" />
                        <Skeleton className="h-3 w-12" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-4" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <Skeleton className="mb-2 h-4 w-44" />
                <Skeleton className="mb-4 h-3 w-60" />
                <div className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              </div>
            </div>
          ) : settingsError ? (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                Failed to load notification settings. Please try again.
              </AlertDescription>
            </Alert>
          ) : localSettings ? (
            <div className="flex flex-col gap-6">
              {saveError && (
                <Alert variant="destructive">
                  <AlertTitle>Save Error</AlertTitle>
                  <AlertDescription>{saveError}</AlertDescription>
                </Alert>
              )}
              <div>
                <h3 className="text-sm font-medium">Login Notifications</h3>
                <p className="text-muted-foreground mb-4 text-sm">
                  Get notified when you log in to your account
                </p>
                <div className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="on_login_email"
                      checked={localSettings.on_login_email}
                      onCheckedChange={(checked) =>
                        handleSettingChange(
                          "on_login_email",
                          checked as boolean,
                        )
                      }
                    />
                    <Label htmlFor="on_login_email" className="text-sm">
                      Email
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="on_login_telegram"
                      checked={localSettings.on_login_telegram}
                      onCheckedChange={(checked) =>
                        handleSettingChange(
                          "on_login_telegram",
                          checked as boolean,
                        )
                      }
                    />
                    <Label htmlFor="on_login_telegram" className="text-sm">
                      Telegram
                    </Label>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium">
                  Daily Loan Application Digest
                </h3>
                <p className="text-muted-foreground mb-4 text-sm">
                  Get a daily digest of new loan applications available in the
                  last 24 hours
                </p>
                <div className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="daily_application_digest_email"
                      checked={localSettings.daily_application_digest_email}
                      onCheckedChange={(checked) =>
                        handleSettingChange(
                          "daily_application_digest_email",
                          checked as boolean,
                        )
                      }
                    />
                    <Label
                      htmlFor="daily_application_digest_email"
                      className="text-sm"
                    >
                      Email
                    </Label>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium">
                  Instant Loan Application Notifications
                </h3>
                <p className="text-muted-foreground mb-4 text-sm">
                  Get notified immediately when a new loan application is
                  available
                </p>
                <div className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="new_loan_applications_telegram"
                      checked={localSettings.new_loan_applications_telegram}
                      onCheckedChange={(checked) =>
                        handleSettingChange(
                          "new_loan_applications_telegram",
                          checked as boolean,
                        )
                      }
                    />
                    <Label
                      htmlFor="new_loan_applications_telegram"
                      className="text-sm"
                    >
                      Telegram
                    </Label>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium">Contract Notifications</h3>
                <p className="text-muted-foreground mb-4 text-sm">
                  Get notified when one of your contracts was updated
                </p>
                <div className="space-y-3">
                  <div>
                    <p className="text-muted-foreground mb-2 text-xs font-medium">
                      Status Changes
                    </p>
                    <div className="flex gap-6">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="contract_status_changed_email"
                          checked={localSettings.contract_status_changed_email}
                          onCheckedChange={(checked) =>
                            handleSettingChange(
                              "contract_status_changed_email",
                              checked as boolean,
                            )
                          }
                        />
                        <Label
                          htmlFor="contract_status_changed_email"
                          className="text-sm"
                        >
                          Email
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="contract_status_changed_telegram"
                          checked={
                            localSettings.contract_status_changed_telegram
                          }
                          onCheckedChange={(checked) =>
                            handleSettingChange(
                              "contract_status_changed_telegram",
                              checked as boolean,
                            )
                          }
                        />
                        <Label
                          htmlFor="contract_status_changed_telegram"
                          className="text-sm"
                        >
                          Telegram
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium">
                  Chat Message Notifications
                </h3>
                <p className="text-muted-foreground mb-4 text-sm">
                  Get notified when you receive new chat messages
                </p>
                <div className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="new_chat_message_email"
                      checked={localSettings.new_chat_message_email}
                      onCheckedChange={(checked) =>
                        handleSettingChange(
                          "new_chat_message_email",
                          checked as boolean,
                        )
                      }
                    />
                    <Label htmlFor="new_chat_message_email" className="text-sm">
                      Email
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="new_chat_message_telegram"
                      checked={localSettings.new_chat_message_telegram}
                      onCheckedChange={(checked) =>
                        handleSettingChange(
                          "new_chat_message_telegram",
                          checked as boolean,
                        )
                      }
                    />
                    <Label
                      htmlFor="new_chat_message_telegram"
                      className="text-sm"
                    >
                      Telegram
                    </Label>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t pt-4">
                <div className="text-muted-foreground text-sm">
                  {hasChanges
                    ? "You have unsaved changes"
                    : "All changes saved"}
                </div>
                <Button
                  onClick={handleSave}
                  disabled={!hasChanges || isSaving}
                  className="min-w-20"
                >
                  {isSaving ? (
                    <>
                      <LuLoader className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
