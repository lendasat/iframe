import { UnlockWalletModal, useWallet } from "@frontend-monorepo/browser-wallet";
import { Box, Button, Flex, Heading, Text, TextField } from "@radix-ui/themes";
import { loadWasmSync, PublicKey, Timestamp } from "@rust-nostr/nostr-sdk";
import { derive_npub } from "browser-wallet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IoMdSend } from "react-icons/io";
import { LuMessageCircle as MessageCircle, LuUnlock as Unlock, LuX as X } from "react-icons/lu";
import { ChatMessage, useNostr } from "./useNostr";

const Avatar = ({
  initial,
  fullString,
  avatar,
  position,
}: {
  initial: string;
  fullString: string;
  avatar?: string;
  position: "left" | "right";
}) => (
  <Box
    className={`w-8 h-8 rounded-full flex items-center justify-center ${
      avatar ? "" : position === "left" ? "bg-purple-100 dark:bg-purple-600" : "bg-gray-200 dark:bg-gray-200"
    } ${position === "left" ? "mr-2" : "ml-2"}`}
  >
    {avatar
      ? (
        <img
          src={avatar}
          alt={`Avatar for ${fullString}`}
          className="w-full h-full rounded-full object-cover bg"
        />
      )
      : (
        <span className="text-sm font-medium text-gray-500">
          {initial.toUpperCase()}
        </span>
      )}
  </Box>
);

interface NostrChatProps {
  otherUser: string;
  chatRoom: string;
  secretKey: string;
  userAvatar?: string;
  otherUserAvatar?: string;
}

const NostrChat = ({
  secretKey,
  chatRoom: chatRoomString,
  otherUser: otherUserString,
  userAvatar,
  otherUserAvatar,
}: NostrChatProps) => {
  loadWasmSync();

  const secret = useMemo(() => secretKey, [secretKey]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const {
    isLoading: isInitializing,
    error,
    publishNote,
    subscribe,
    publicKey,
    client,
    fetchChatMessages,
    unsubscribeWithId,
  } = useNostr(secret);

  if (error) {
    console.error(`Nostr error: ${error}`);
  }

  const user = publicKey;

  let chatRoom;
  let otherUser;
  try {
    chatRoom = useMemo(() => PublicKey.parse(chatRoomString), [chatRoomString]);
  } catch (e) {
    console.error(`Invalid chatRoomPk: ${e}`);
    throw e;
  }
  try {
    otherUser = useMemo(() => PublicKey.parse(otherUserString), [otherUserString]);
  } catch (e) {
    console.error(`Invalid other usd pk: ${e}`);
    throw e;
  }

  const handleEvent = useCallback((event: ChatMessage) => {
    setMessages((prevEvents) => {
      const eventExists = prevEvents.some(
        (prevEvent) => prevEvent.eventId.toHex() === event.eventId.toHex(),
      );
      if (!eventExists) {
        return [...prevEvents, event];
      }
      return prevEvents;
    });
  }, []);

  const handleSend = async () => {
    setIsLoading(true);
    if (!user) {
      console.error("Can't send without local user");
      return;
    }

    if (newMessage.trim()) {
      try {
        await publishNote(otherUser, chatRoom, newMessage.trim());
        const sendEventOutput2 = await publishNote(user, chatRoom, newMessage.trim());
        handleEvent({
          sender: user.toBech32(),
          eventId: sendEventOutput2.id,
          content: newMessage.trim(),
          createdAt: Timestamp.now(),
          tags: [],
        });
      } catch (error) {
        console.log(`Failed sending message ${error}`);
      }
      setNewMessage("");
    }
    setIsLoading(false);
  };

  const cleanup = useCallback(async () => {
    if (client) {
      console.log("Unsubscribing from chat messages");
      await unsubscribeWithId("dms");
    }
  }, [client, unsubscribeWithId]);

  useEffect(() => {
    if (!client || !user) {
      console.log("Not ready to sync yet");
      return;
    }

    const initializeChat = async () => {
      setIsLoading(true);
      try {
        await fetchChatMessages(user, otherUser, chatRoom, handleEvent);
        await subscribe(user, "dms", chatRoom, handleEvent);
      } catch (error) {
        console.log(`Failed fetching/subscribing to messages: ${error}`);
        await cleanup();
      } finally {
        setIsLoading(false);
      }
    };

    initializeChat();

    return () => {
      cleanup();
    };
  }, [client, user, otherUser, chatRoom, handleEvent, cleanup, fetchChatMessages, subscribe]);

  const sortedMessages = messages.sort((a, b) => a.createdAt.asSecs() - b.createdAt.asSecs());

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Effect to scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [sortedMessages, scrollToBottom]);

  return (
    <>
      <Box className="h-96 overflow-y-auto p-4 space-y-4">
        {sortedMessages.map((message) => (
          <div
            key={message.eventId.toHex()}
            className={`flex items-start ${message.sender === otherUser.toBech32() ? "justify-end" : "justify-start"}`}
          >
            {message.sender === user?.toBech32() && (
              <Avatar
                initial={message.sender[0]}
                fullString={message.sender}
                avatar={userAvatar}
                position="left"
              />
            )}

            <Box
              className={`p-3 rounded-lg ${
                message.sender === otherUser.toBech32()
                  ? "bg-gray-200 dark:bg-gray-700 rounded-br-none"
                  : "bg-purple-100 dark:bg-purple-900 rounded-br-none"
              }`}
            >
              <Flex direction={"column"}>
                <Text size={"2"} className={`text-gray-900 dark:text-gray-100`}>
                  {message.content}
                </Text>
                <Text size={"1"}>
                  {new Date(message.createdAt.asSecs() * 1000).toLocaleString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </Text>
              </Flex>
            </Box>
            {message.sender === otherUser.toBech32() && (
              <Avatar
                initial={otherUserString[0]}
                fullString={otherUserString}
                avatar={otherUserAvatar}
                position="right"
              />
            )}
          </div>
        ))}

        {/* Invisible div at the bottom for scrolling */}
        <div ref={messagesEndRef} />
      </Box>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await handleSend();
        }}
        className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-2"
      >
        <TextField.Root
          value={newMessage}
          size={"3"}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-grow px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
        />
        <Button
          type="submit"
          color={"purple"}
          loading={isLoading || isInitializing}
          size={"3"}
        >
          <IoMdSend className="h-4 w-4" />
        </Button>
      </form>
    </>
  );
};

interface ChatDrawerProps {
  contractId: string;
  counterpartyXPub: string;
}

export const ChatDrawer = ({ contractId, counterpartyXPub }: ChatDrawerProps) => {
  console.log(`I'm reloading chat drawer`);
  const [isOpen, setIsOpen] = useState(false);
  const [showUnlockWalletModal, setShowUnlockWalletModal] = useState(false);
  const { doesWalletExist, isWalletLoaded, getNsec, getPubkeyFromContract } = useWallet();
  const handleCloseUnlockWalletModal = () => setShowUnlockWalletModal(false);
  const handleOpenUnlockWalletModal = () => setShowUnlockWalletModal(true);
  const handleSubmitUnlockWalletModal = async () => {
    handleCloseUnlockWalletModal();
  };

  const contractIdMemorized = useMemo(() => {
    return contractId;
  }, [contractId]);
  const counterpartyXPubMemorized = useMemo(() => {
    return counterpartyXPub;
  }, [counterpartyXPub]);

  const nsec = isWalletLoaded ? getNsec() : null;
  const chatRoom = isWalletLoaded ? getPubkeyFromContract(contractIdMemorized) : null;
  const counterpartyNPub = isWalletLoaded ? derive_npub(counterpartyXPubMemorized) : null;

  const toggleDrawer = () => {
    setIsOpen(!isOpen);
  };

  const handleUnlock = () => {
    try {
      if (!doesWalletExist) {
        throw new Error("Wallet does not exist. Try to log back in");
      }
      if (!isWalletLoaded) {
        handleOpenUnlockWalletModal();
        return;
      }
    } catch (error) {
      console.log(`Unexpected error happened ${error}`);
    }
  };

  const chatConfig = useMemo(() => {
    if (!counterpartyNPub || !chatRoom || !nsec) {
      return null;
    }
    return {
      otherUser: counterpartyNPub,
      chatRoom: chatRoom,
      secretKey: nsec,
    };
  }, [counterpartyNPub, chatRoom, nsec]);

  return (
    <Box className="fixed bottom-0 right-0 z-50">
      {/* Chat Toggle Button */}
      <Button
        onClick={toggleDrawer}
        className={`mb-4 mr-4 p-4 bg-purple-500 text-white rounded-full shadow-lg hover:bg-purple-600 transition-all duration-300 ${
          isOpen ? "rotate-90" : ""
        }`}
      >
        <Text>Chat with counterparty</Text>
        {<MessageCircle size={24} />}
      </Button>

      {/* Chat Drawer */}
      <Box
        className={`fixed bottom-0 right-0 w-96 bg-white shadow-lg rounded-t-xl transition-transform duration-300 transform ${
          isOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Header */}
        <Box className="p-4 bg-purple-500 text-white rounded-t-xl flex justify-between items-center">
          <Heading size={"3"} className="font-semibold">
            Chat
          </Heading>
          <Button
            onClick={toggleDrawer}
            className="text-white hover:text-gray-200 transition-colors bg-transparent"
          >
            <X size={20} />
          </Button>
        </Box>

        {isWalletLoaded && chatConfig
          ? <NostrChat {...chatConfig} />
          : (
            <Box className="h-96 flex items-center justify-center">
              <Button
                onClick={handleUnlock}
                size="4"
                color="purple"
                className="flex items-center gap-2"
              >
                <Unlock size={24} />
                <Text>Unlock Chat</Text>
              </Button>
            </Box>
          )}
      </Box>
      <UnlockWalletModal
        show={showUnlockWalletModal}
        handleClose={handleCloseUnlockWalletModal}
        handleSubmit={handleSubmitUnlockWalletModal}
      />
    </Box>
  );
};

export default ChatDrawer;
