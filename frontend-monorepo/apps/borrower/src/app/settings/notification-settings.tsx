import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Alert,
  AlertDescription,
  AlertTitle,
} from "@frontend/shadcn";
import TelegramBotDetails from "./TelegramBotDetails";
import { useAuth } from "@frontend/http-client-borrower";

export function NotificationSettings() {
  const { user } = useAuth();

  const maybeBotUrl = import.meta.env.VITE_TELEGRAM_BOT_URL;
  const maybeBotName = import.meta.env.VITE_TELEGRAM_BOT_NAME;
  const maybePersonalTelegramToken = user?.personal_telegram_token;

  let error = false;
  if (!maybeBotUrl || !maybeBotName || !maybePersonalTelegramToken) {
    error = true;
  }

  console.log(maybeBotUrl);
  console.log(maybeBotName);
  console.log(maybePersonalTelegramToken);

  const botUrl = maybeBotUrl || "";
  const botName = maybeBotName || "";
  const personalTelegramToken = maybePersonalTelegramToken || "";

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
        <CardContent>
          {error ? (
            <Alert variant="warning" className="mt-4">
              <AlertTitle>Woops!</AlertTitle>
              <AlertDescription>
                Telegram notifications are currently unavailable.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="mt-4">
              <TelegramBotDetails
                token={personalTelegramToken}
                botUrl={botUrl}
                botName={botName}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
