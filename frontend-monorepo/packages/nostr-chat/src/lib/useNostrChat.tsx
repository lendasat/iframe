import { useState, useEffect, useCallback, useRef } from "react";
import {
  Alphabet,
  Client,
  ClientBuilder,
  Duration,
  Event,
  EventBuilder,
  EventId,
  Filter,
  initLogger,
  Keys,
  Kind,
  loadWasmSync,
  LogLevel,
  NostrDatabase,
  NostrSigner,
  Options,
  PublicKey,
  Relay,
  RelayMessage,
  RelayMetadata,
  SingleLetterTag,
  Tag,
  Timestamp,
} from "@rust-nostr/nostr-sdk";

export interface NostrMessageEvent {
  id: EventId;
  author: PublicKey;
  content: string;
  createdAt: Timestamp;
  tags: Tag[];
}

const RELAYS = [
  "wss://relay.nostrdice.com",
  "wss://relay.primal.net",
  "wss://relay.damus.io",
  "wss://relay.satsdays.com",
];

interface UseNostrResult {
  isReady: boolean;
  error: string | null;
  personalPublicKey: PublicKey | null;
  initializeClient: (nsec: string) => Promise<void>;
  sendMessage: (
    receiver: string,
    room: string,
    content: string,
    subject: string,
  ) => Promise<EventId | null>;
  onNewMessage: (callback: (msg: NostrMessageEvent) => void) => void;
  subscribeToMessages: (
    counterpartyNpubString?: string,
    contractNpub?: string,
  ) => Promise<() => void>;
  fetchMessages: (chatRoom: string) => Promise<void>;
}

const useNostr = (): UseNostrResult => {
  loadWasmSync();

  const [isReady, setIsReady] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [personalPublicKey, setPersonalPublicKey] = useState<PublicKey | null>(
    null,
  );
  const relayConnections = useRef<Record<string, Relay>>({});
  const subscriptions = useRef<Record<string, any>>({});
  const onNewMessageCallback =
    useRef<(msg: NostrMessageEvent) => void | null>(null);
  const clientRef = useRef<Client | undefined>(undefined);
  const relaysRef = useRef<string[]>(RELAYS);

  const initializeClient = useCallback(async (nsec: string): Promise<void> => {
    if (isInitializing) {
      console.log("Already initializing...");
      return;
    }

    try {
      initLogger(LogLevel.info());
    } catch (error) {
      console.log(error);
    }

    setIsInitializing(true);
    if (!nsec) {
      setError("nsec is required for initialization.");
      return;
    }

    try {
      const privateKey = Keys.parse(nsec);
      const nostrSigner = NostrSigner.keys(privateKey);
      const db = await NostrDatabase.indexeddb("lendasat-nostr-db");
      const opts = new Options().autoconnect(false).gossip(false);

      const client = new ClientBuilder()
        .signer(nostrSigner)
        .database(db)
        .opts(opts)
        .build();

      clientRef.current = client;

      // Connect to relays
      for (let i = 0; i < relaysRef.current.length; i++) {
        await client.addRelay(relaysRef.current[i]);
      }

      console.log("Connecting chat...");

      await client.connect();
      await client.waitForConnection(Duration.fromSecs(3));

      console.log("Chat connected!");

      const tags = RELAYS.map((relay) => {
        return Tag.relayMetadata(relay, RelayMetadata.Write);
      });

      // TODO: we should check if the profile has been registered before, and only send if not
      const event = new EventBuilder(new Kind(10002), "").tags(tags);
      await client.sendEventBuilder(event);

      setPersonalPublicKey(privateKey.publicKey);
      setIsReady(true);
      setError(null);
    } catch (err: any) {
      setError(`Error initializing Nostr client: ${err}`);
      setIsReady(false);
    } finally {
      setIsInitializing(false);
    }
  }, []);

  const subscribeToMessages = useCallback(
    async (
      counterpartyNpubString?: string,
      contractNpub?: string,
    ): Promise<() => void> => {
      if (
        isReady &&
        personalPublicKey &&
        clientRef.current &&
        counterpartyNpubString &&
        contractNpub &&
        onNewMessageCallback.current
      ) {
        try {
          const counterpartyPubKey = PublicKey.parse(counterpartyNpubString);
          const chatRoom = PublicKey.parse(contractNpub);

          console.log(`Chat detail \n
          personal pub key: ${personalPublicKey.toBech32()} \n
          counterparty pub key: ${counterpartyPubKey.toBech32()} \n
          chatroom pub key: ${chatRoom.toBech32()}
          `);

          const filter = new Filter()
            .kind(new Kind(1059))
            .customTag(
              SingleLetterTag.lowercase(Alphabet.P),
              personalPublicKey.toHex(),
            );

          const subscription = await clientRef.current.subscribe(filter);
          subscriptions.current[subscription.id] = subscription;

          const handle = {
            // Handle event
            handleEvent: async (
              relayUrl: string,
              subscriptionId: string,
              event: Event,
            ) => {
              console.debug(
                `Received new event from ${relayUrl} with subscription id ${subscriptionId} and kind ${event.kind.asU16()}. Expect chat room ${chatRoom.toHex()}`,
              );

              if (event.kind.asU16() === new Kind(1059).asU16()) {
                const unwrappedGift =
                  await clientRef.current!.unwrapGiftWrap(event);
                if (
                  unwrappedGift.rumor.tags.find((t) => {
                    return t.content() === chatRoom.toHex();
                  })
                ) {
                  if (onNewMessageCallback?.current && counterpartyPubKey) {
                    onNewMessageCallback.current({
                      id: event.id,
                      content: unwrappedGift.rumor.content,
                      author: unwrappedGift.rumor.pubkey,
                      createdAt: unwrappedGift.rumor.createdAt,
                      tags: unwrappedGift.rumor.tags,
                    });
                  } else {
                    console.error(
                      "Can't send message if callback is not defined",
                    );
                  }
                }
              }
              return false;
            },
            // Handle relay message
            handleMsg: async (_relayUrl: string, _message: RelayMessage) => {
              return false;
            },
          };

          clientRef.current.handleNotifications(handle);

          return () => {
            if (subscriptions.current[subscription.id] && clientRef.current) {
              clientRef.current.unsubscribe(subscription.id);
              delete subscriptions.current[subscription.id];
            }
          };
        } catch (error: any) {
          console.error("Error subscribing to messages:", error);
          setError(`Error subscribing to messages: ${error.message}`);
          return () => {}; // Return an empty cleanup function in case of error
        }
      }
      return () => {}; // Return an empty cleanup if dependencies are not met
    },
    [isReady, personalPublicKey, clientRef, onNewMessageCallback],
  );

  const sendMessage = useCallback(
    async (
      receiver: string,
      room: string,
      content: string,
      subject: string,
    ): Promise<EventId | null> => {
      if (!isReady || !personalPublicKey || !clientRef.current) {
        console.warn(
          "Nostr client not ready or publicKey/client not available.",
        );
        setError("Nostr client not ready or publicKey/client not available.");
        return null;
      }

      try {
        const chatRoom = PublicKey.parse(room);
        console.log("Chat root room", chatRoom.toBech32());

        const counterpartyPubKey = PublicKey.parse(receiver);

        const senderRumor = new EventBuilder(new Kind(14), content)
          .allow_self_tagging()
          .tags([
            Tag.publicKey(chatRoom),
            Tag.publicKey(personalPublicKey),
            Tag.publicKey(counterpartyPubKey),
            Tag.parse(["subject", subject]),
          ])
          .build(personalPublicKey);
        const senderOutput = await clientRef.current?.giftWrap(
          personalPublicKey,
          senderRumor,
          [],
        );

        const receiverRumor = new EventBuilder(new Kind(14), content)
          .allow_self_tagging()
          .tags([
            Tag.publicKey(chatRoom),
            Tag.publicKey(personalPublicKey),
            Tag.publicKey(counterpartyPubKey),
            Tag.parse(["subject", subject]),
          ])
          .build(personalPublicKey);
        const receiverOutput = await clientRef.current?.giftWrap(
          counterpartyPubKey,
          receiverRumor,
          [],
        );

        if (onNewMessageCallback?.current) {
          onNewMessageCallback.current({
            id: senderOutput.id,
            content: content,
            author: personalPublicKey,
            createdAt: Timestamp.now(),
            tags: [Tag.publicKey(chatRoom)],
          });
        } else {
          console.error("Can't send message if callback is not defined");
        }

        return receiverOutput.id;
      } catch (err: any) {
        console.error("Error sending message:", err);
        setError(`Error sending message: ${err.message}`);
        return null;
      }
    },
    [isReady, personalPublicKey, clientRef],
  );

  const onNewMessage = useCallback(
    (callback: (msg: NostrMessageEvent) => void) => {
      // We need to adapt the callback to the ref's type
      onNewMessageCallback.current = (msg: NostrMessageEvent) => {
        callback(msg);
      };
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.shutdown();
      }
      Object.values(relayConnections.current).forEach((relay) => {
        relay.disconnect();
      });
      Object.values(subscriptions.current).forEach((sub) => {
        if (typeof sub?.unsub === "function") {
          sub.unsub();
        }
      });
    };
  }, []); // Cleanup on unmount

  const fetchMessages = useCallback(
    async (chatRoomString: string) => {
      if (!clientRef.current || !personalPublicKey) {
        console.log("Error client not set");
        return;
      }
      const chatRoom = PublicKey.parse(chatRoomString);

      const unwrappedEvents: NostrMessageEvent[] = [];

      {
        const filter = new Filter()
          .kind(new Kind(1059))
          .customTag(
            SingleLetterTag.lowercase(Alphabet.P),
            personalPublicKey.toHex(),
          );
        const events = await clientRef.current.fetchEvents(
          filter,
          Duration.fromSecs(5),
        );
        for (const event of events.toVec()) {
          try {
            const unwrappedGift = await clientRef.current.unwrapGiftWrap(event);
            if (
              unwrappedGift.rumor.tags.find((t) => {
                return (
                  (t.content() && t.content() === chatRoom.toHex()) ||
                  t.content() === personalPublicKey.toHex()
                );
              })
            ) {
              unwrappedEvents.push({
                id: event.id,
                author: unwrappedGift.rumor.pubkey,
                content: unwrappedGift.rumor.content,
                createdAt: unwrappedGift.rumor.createdAt,
                tags: unwrappedGift.rumor.tags,
              });
            }
          } catch (error) {
            console.log(`Failed decrypting ${error}`);
          }
        }
      }

      if (onNewMessageCallback?.current) {
        for (const event of unwrappedEvents) {
          onNewMessageCallback.current(event);
        }
      } else {
        console.error("Can't send message if callback is not defined");
      }
    },
    [clientRef, personalPublicKey],
  );

  return {
    isReady,
    error,
    personalPublicKey,
    initializeClient,
    sendMessage,
    onNewMessage,
    subscribeToMessages,
    fetchMessages,
  };
};

export default useNostr;
