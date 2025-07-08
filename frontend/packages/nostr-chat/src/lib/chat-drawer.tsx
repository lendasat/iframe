import { Box, Button, Heading, Text } from "@radix-ui/themes";
import { useState } from "react";
import { LuMessageCircle as MessageCircle, LuX as X } from "react-icons/lu";
import Chat from "./chat";

interface ChatDrawerProps {
  contractId?: string;
  counterpartyNpub?: string;
  personalName?: string;
  counterpartyName?: string;
  onNewMsgSent?: () => Promise<void>;
}

export const ChatDrawer = ({
  contractId,
  counterpartyNpub,
  onNewMsgSent,
  personalName,
  counterpartyName,
}: ChatDrawerProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleDrawer = () => {
    setIsOpen(!isOpen);
  };

  return (
    <Box className="fixed bottom-0 right-0 z-50">
      {/* Chat Toggle Button */}
      <Button
        onClick={toggleDrawer}
        className={`mb-4 mr-4 rounded-full bg-purple-500 p-4 text-white shadow-lg transition-all duration-300 hover:bg-purple-600 ${
          isOpen ? "rotate-90" : ""
        }`}
      >
        <Text>Chat with counterparty</Text>
        {<MessageCircle size={24} />}
      </Button>

      {/* Chat Drawer */}
      <Box
        className={`fixed bottom-0 right-0 w-96 transform rounded-t-xl bg-white shadow-lg transition-transform duration-300 ${
          isOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Header */}
        <Box className="flex items-center justify-between rounded-t-xl bg-purple-500 p-4 text-white">
          <Heading size={"3"} className="font-semibold">
            Chat
          </Heading>
          <Button
            onClick={toggleDrawer}
            className="bg-transparent text-white transition-colors hover:text-gray-200"
          >
            <X size={20} />
          </Button>
        </Box>

        <Chat
          contractId={contractId}
          counterpartyNpub={counterpartyNpub}
          counterpartyName={counterpartyName}
          personalName={personalName}
          onNewMsgSent={onNewMsgSent}
        />
      </Box>
    </Box>
  );
};

export default ChatDrawer;
