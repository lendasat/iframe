import { Button, Card, Flex } from "@radix-ui/themes";
import { useState } from "react";

interface TelegramNotificationSetupProps {
  token: string;
  botName: string;
  botUrl: string;
}

const TelegramNotificationSetup = ({ token, botName, botUrl }: TelegramNotificationSetupProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="bg-slate-50 p-6 rounded-lg">
      <div className="space-y-4">
        <p className="text-gray-700 leading-relaxed">
          You can receive notifications from Lendasat to your Telegram account. To do this, follow further instructions:
        </p>

        <div className="space-y-4">
          <div className="flex items-start space-x-2">
            <span className="font-medium">1.</span>
            <div className="space-y-2">
              <p className="text-gray-700">To activate Telegram notifications bot, follow the link below.</p>
              <a
                href={`${botUrl}?start=${token}`}
                target="_blank"
                rel="noreferrer"
                className="text-purple-500 hover:text-purple-600 break-all"
              >
                {botUrl}?start={token}
              </a>
            </div>
          </div>

          <div className="flex items-start space-x-2">
            <span className="font-medium">2.</span>
            <div className="space-y-2">
              <p className="text-gray-700">
                If you can't access the link, join the telegram bot manually and provide your notifications key
                manually.
                <br />
                <span className="text-purple-500">
                  <a
                    href={`${botUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-purple-500 hover:text-purple-600 break-all"
                  >
                    {" "}
                    {botUrl}
                    {" "}
                  </a>
                </span>
              </p>

              <Flex gap={"3"}>
                <div className="flex items-center space-x-2 bg-gray-100 p-2 rounded-md">
                  <code className="text-gray-700 font-mono">{token}</code>
                </div>
                <Button
                  onClick={handleCopy}
                  variant={"surface"}
                  className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded"
                >
                  {copied ? "Copied!" : "Click to copy"}
                </Button>
              </Flex>
            </div>
          </div>
        </div>

        <p className="text-gray-700 mt-4">
          In order to stop using the Telegram bot, type /stop command.
        </p>
      </div>
    </Card>
  );
};

export default TelegramNotificationSetup;
