import { LuLoader, LuSend } from "react-icons/lu";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Avatar,
  AvatarFallback,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  ScrollArea,
} from "@frontend/shadcn";
import useNostr, { NostrMessageEvent } from "./useNostrChat";
import { useWallet } from "@frontend/browser-wallet";

interface ChatProps {
  contractId?: string;
  counterpartyNpub?: string;
  personalName?: string;
  counterpartyName?: string;
  onNewMsgSent?: () => Promise<void>;
}

export const Chat = ({
  contractId,
  counterpartyNpub,
  onNewMsgSent,
  personalName,
  counterpartyName,
}: ChatProps) => {
  const [nsec, setNsec] = useState<string | undefined>();
  const [contractNpub, setContractNpub] = useState<string | undefined>();
  const [messagesMap, setMessagesMap] = useState<
    Map<string, NostrMessageEvent>
  >(new Map());
  const [newMessage, setNewMessage] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const unsubscribeMessages = useRef<(() => void) | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const { getNsec, getPubkeyFromContract } = useWallet();
  const {
    isReady,
    error,
    personalPublicKey,
    initializeClient,
    sendMessage,
    onNewMessage,
    subscribeToMessages,
    fetchMessages,
  } = useNostr();
  if (error) {
    console.error(`Received an error ${error}`);
  }

  useEffect(() => {
    const loadWalletInfo = async () => {
      const fetchedNsec = await getNsec();
      setNsec(fetchedNsec);
      if (contractId) {
        const contracNpubHex = getPubkeyFromContract(contractId);
        console.log(`Got contract npub hex: ${contracNpubHex}`);
        setContractNpub(contracNpubHex);
      }
    };

    loadWalletInfo();
  }, [getNsec, getPubkeyFromContract, contractId]);

  useEffect(() => {
    if (nsec && !isInitialized) {
      initializeClient(nsec)
        .then(() => {
          setIsInitialized(true);
        })
        .catch((err) => {
          console.error("Error initializing client:", err);
        });
    }
  }, [nsec, initializeClient, isInitialized, isReady]);

  useEffect(() => {
    if (isInitialized && contractNpub && !hasFetched && !isSubscribed) {
      let isMounted = true;

      fetchMessages(contractNpub)
        .then(() => {
          if (isMounted) {
            setHasFetched(true);
          }
        })
        .catch((err) => {
          console.error("Error subscribing:", err);
        });

      return () => {
        isMounted = false;
        console.debug("Unsubscribing from fetching messagesMap (cleanup)");
        setHasFetched(false);
      };
    }
  }, [isInitialized, contractNpub, subscribeToMessages, isSubscribed]);

  useEffect(() => {
    if (isInitialized && counterpartyNpub && contractNpub && !isSubscribed) {
      let isMounted = true;

      subscribeToMessages(counterpartyNpub, contractNpub)
        .then((unsubscribe) => {
          if (isMounted) {
            unsubscribeMessages.current = unsubscribe;
            setIsSubscribed(true);
          }
        })
        .catch((err) => {
          console.error("Error subscribing:", err);
        });

      return () => {
        isMounted = false;
        if (unsubscribeMessages.current) {
          unsubscribeMessages.current();
          console.debug("Unsubscribing from messagesMap (cleanup)");
          setIsSubscribed(false);
        }
      };
    }
  }, [isInitialized, counterpartyNpub, contractNpub, subscribeToMessages]);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      const viewport = messagesEndRef.current.querySelector(
        "[data-radix-scroll-area-viewport]",
      );
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messagesMap, scrollToBottom]);

  useEffect(() => {
    onNewMessage((msg) => {
      if (
        !msg.tags.some((tag) => {
          return tag.content() === contractNpub;
        })
      ) {
        // ignoring as not relevant for us
        return;
      }

      setMessagesMap((prevMap) => {
        // Create a new Map to avoid mutating state
        const newMap = new Map(prevMap);

        // Add the new message (automatically overwrites if ID exists)
        newMap.set(msg.id.toBech32(), msg);

        // Get sorted array of messages
        const sortedMessages = Array.from(newMap.values()).sort(
          (a, b) => a.createdAt.asSecs() - b.createdAt.asSecs(),
        );

        // Create a new map from the sorted messages
        const map = sortedMessages.map(
          (message) =>
            [message.id.toBech32(), message] as [string, NostrMessageEvent],
        );
        return new Map(map);
      });
    });
  }, [onNewMessage, setMessagesMap, contractNpub]);

  const handleSendMessage = useCallback(async () => {
    if (isInitialized && counterpartyNpub && contractNpub && newMessage) {
      await sendMessage(counterpartyNpub, contractNpub, newMessage);
      setNewMessage("");
      if (onNewMsgSent) {
        await onNewMsgSent();
      }
    }
  }, [
    isInitialized,
    counterpartyNpub,
    contractNpub,
    newMessage,
    sendMessage,
    onNewMsgSent,
  ]);

  const messages = useMemo(
    () =>
      Array.from(messagesMap.values()).sort(
        (a, b) => a.createdAt.asSecs() - b.createdAt.asSecs(),
      ),
    [messagesMap],
  );

  return (
    <Card className="shadow-md h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Communication Channel</CardTitle>
        <CardDescription>Chat with the other party</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden p-0">
        <ScrollArea className="h-[500px] p-4" ref={messagesEndRef}>
          {messages.map((msg) => (
            <div
              key={msg.id.toBech32()}
              className={`mb-4 ${msg.author.toBech32() === "system" ? "px-4" : ""}`}
            >
              {msg.author.toBech32() === "system" ? (
                <div className="bg-gray-100 rounded-md p-2 text-xs text-center text-gray-600">
                  {msg.content} • {msg.createdAt.toHumanDatetime()}
                </div>
              ) : (
                <div
                  className={`flex ${msg.author.toBech32() === counterpartyNpub ? "justify-end" : "justify-start"}`}
                >
                  {msg.author.toBech32() === personalPublicKey?.toBech32() && (
                    <Avatar className="h-8 w-8 mr-2">
                      <AvatarFallback>
                        {personalName
                          ? personalName[0]
                          : msg.author.toBech32()[0]}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div>
                    <div
                      className={`rounded-lg p-3 max-w-xs ${
                        msg.author.toBech32() === counterpartyNpub
                          ? "bg-black text-white ml-2"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      <p className="text-sm">{msg.content}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {msg.createdAt.toHumanDatetime()}
                    </p>
                  </div>
                  {msg.author.toBech32() === counterpartyNpub && (
                    <Avatar className="h-8 w-8 ml-2">
                      <AvatarFallback>
                        <AvatarFallback>
                          {counterpartyName
                            ? counterpartyName[0]
                            : msg.author.toBech32()[0]}
                        </AvatarFallback>
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              )}
            </div>
          ))}
          {/* Invisible div at the bottom for scrolling */}
        </ScrollArea>
      </CardContent>
      <CardFooter className="border-t p-4">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await handleSendMessage();
          }}
          className="flex w-full gap-2"
        >
          <Input
            placeholder="Type your message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="rounded-r-none"
          />
          <Button
            type={"submit"}
            variant={"outline"}
            size={"icon"}
            disabled={!isInitialized}
          >
            {!isInitialized ? (
              <>
                <LuLoader className="animate-spin" />
              </>
            ) : (
              <LuSend className="h-4 w-4" />
            )}
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
};

export default Chat;
