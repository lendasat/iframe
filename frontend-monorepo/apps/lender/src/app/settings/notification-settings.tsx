import { Box, Callout, Heading } from "@radix-ui/themes";
import { IoInformationCircleOutline } from "react-icons/io5";
import TelegramBotDetails from "./TelegramBotDetails";
import { useAuth } from "@frontend/http-client-lender";

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
    <Box className="md:pl-8">
      <Heading
        as="h4"
        className="text-font dark:text-font-dark font-semibold"
        size={"5"}
      >
        Notification Settings
      </Heading>
      <Box mt={"6"} className="space-y-4">
        <Box className="rounded-2xl border border-purple-400/20 px-5 py-6 dark:border-gray-500/50">
          <Heading
            as="h4"
            className="text-font dark:text-font-dark font-semibold capitalize"
            size={"3"}
          >
            Telegram Bot
          </Heading>
          {error ? (
            <Callout.Root color="orange">
              <Callout.Icon>
                <IoInformationCircleOutline />
              </Callout.Icon>
              <Callout.Text>
                Telegram bot has not been configured correctly
              </Callout.Text>
            </Callout.Root>
          ) : (
            <Box mt={"4"} className="w-full">
              <TelegramBotDetails
                token={personalTelegramToken}
                botUrl={botUrl}
                botName={botName}
              />
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
