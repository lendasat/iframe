import { Button } from "@frontend/shadcn";
import { LuCopy } from "react-icons/lu";
import { toast } from "sonner";

interface TelegramNotificationSetupProps {
  token: string;
  botName: string;
  botUrl: string;
}

const TelegramNotificationSetup = ({
  token,
  botName,
  botUrl,
}: TelegramNotificationSetupProps) => {
  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(token);
      toast.success("Copied Telegram token.");
    } catch (e) {
      console.error(`Failed to copy Telegram token: ${e}`);
      toast.error(`Failed to copy Telegram token.`);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-font dark:text-font-dark leading-relaxed">
        To enable Telegram notifications you can either:
      </p>

      <div className="space-y-4">
        <div className="flex items-start space-x-2">
          <span className="text-font dark:text-font-dark text-medium">-</span>
          <div className="space-y-2">
            <p className="text-font dark:text-font-dark">
              Follow this link:{" "}
              <a
                href={`${botUrl}?start=${token}`}
                target="_blank"
                rel="noreferrer"
                className="break-all text-purple-500 hover:text-purple-600"
              >
                {botUrl}?start={token}
              </a>
              .
            </p>
          </div>
        </div>

        <div className="flex items-start space-x-2">
          <span className="text-font dark:text-font-dark text-medium">-</span>
          <div className="space-y-2">
            <p className="text-font dark:text-font-dark">
              Find <code>{botName}</code> on Telegram; press <em>Start</em>; and
              provide your personal token.
            </p>

            <div className="flex items-center">
              <div className={"text-font dark:text-font-dark mr-2"}>
                <code>{token}</code>
              </div>
              <Button size="icon" variant="ghost" onClick={handleCopy}>
                <LuCopy />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <p className="text-font dark:text-font-dark mt-4">
        Once configured, in order to opt out of Telegram notifications, type{" "}
        <code>/stop</code> in the chat.
      </p>
    </div>
  );
};

export default TelegramNotificationSetup;
