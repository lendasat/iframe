import { Button, Card, Flex } from "@radix-ui/themes";
import { useState } from "react";

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
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="bg-light dark:bg-dark rounded-lg p-6">
      <div className="space-y-4">
        <p className="text-font dark:text-font-dark leading-relaxed">
          You can receive notifications from Lendasat to your Telegram account.
          To do this, follow further instructions:
        </p>

        <div className="space-y-4">
          <div className="flex items-start space-x-2">
            <span className="text-font dark:text-font-dark font-medium">
              1.
            </span>
            <div className="space-y-2">
              <p className="text-font dark:text-font-dark">
                To activate Telegram notifications bot, follow the link below.
              </p>
              <a
                href={`${botUrl}?start=${token}`}
                target="_blank"
                rel="noreferrer"
                className="break-all text-purple-500 hover:text-purple-600"
              >
                {botUrl}?start={token}
              </a>
            </div>
          </div>

          <div className="flex items-start space-x-2">
            <span className="text-font dark:text-font-dark text-medium">
              2.
            </span>
            <div className="space-y-2">
              <p className="text-font dark:text-font-dark">
                If you can't access the link, join the telegram bot manually and
                provide your notifications key manually.
                <br />
                <span className="text-purple-500">
                  <a
                    href={`${botUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-purple-500 hover:text-purple-600"
                  >
                    {" "}
                    {botUrl}{" "}
                  </a>
                </span>
              </p>

              <Flex gap={"3"}>
                <div className="bg-light dark:bg-dark flex items-center space-x-2 rounded-md p-2">
                  <code className="text-font dark:text-font-dark font-mono">
                    {token}
                  </code>
                </div>
                <Button
                  onClick={handleCopy}
                  variant={"surface"}
                  className="rounded bg-purple-500 px-4 py-2 text-white hover:bg-purple-600"
                >
                  {copied ? "Copied!" : "Click to copy"}
                </Button>
              </Flex>
            </div>
          </div>
        </div>

        <p className="text-font dark:text-font-dark mt-4">
          In order to stop using the Telegram bot, type /stop command.
        </p>
      </div>
    </Card>
  );
};

export default TelegramNotificationSetup;
