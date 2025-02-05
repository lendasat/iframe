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
  RelayMessage,
  RelayMetadata,
  SingleLetterTag,
  Tag,
  Timestamp,
} from "@rust-nostr/nostr-sdk";
import { useCallback, useEffect, useState } from "react";

export const RELAYS = [
  "wss://relay.nostrdice.com",
  "wss://relay.primal.net",
  "wss://relay.damus.io",
  "wss://relay.satsdays.com",
];

export interface ChatMessage {
  sender: string;
  // ID of the event sent via nostr, not the rumor's (inner) event id
  eventId: EventId;
  content: string;
  createdAt: Timestamp;
  tags: Tag[];
}

export function useNostr(secretKey: string) {
  const [keys, setKeys] = useState<Keys | null>();
  const [publicKey, setPublicKey] = useState<PublicKey | null>();
  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null | string>(null);

  useEffect(() => {
    loadWasmSync();
    let mounted = true;
    let currentClient: Client | null = null; // Create a local reference

    const initNostr = async () => {
      try {
        try {
          initLogger(LogLevel.info());
        } catch (error) {
          console.log(error);
        }

        const newKeys = Keys.parse(secretKey);
        const nostrSigner = NostrSigner.keys(newKeys);
        const db = await NostrDatabase.indexeddb("lendasat-nostr-db");
        const opts = new Options().autoconnect(true).gossip(false);

        const newClient = new ClientBuilder()
          .signer(nostrSigner)
          .database(db)
          .opts(opts)
          .build();

        // Store the client in our local reference
        currentClient = newClient;

        // Connect to relays
        for (let i = 0; i < RELAYS.length; i++) {
          await newClient.addRelay(RELAYS[i]);
        }

        const newPublicKey = await nostrSigner.publicKey();

        const event = new EventBuilder(
          new Kind(10002),
          "",
        ).tags([Tag.relayMetadata("wss://relay.nostrdice.com", RelayMetadata.Write)]);
        await newClient.sendEventBuilder(event);

        if (mounted) {
          setPublicKey(newPublicKey);
          setKeys(newKeys);
          setClient(newClient);
        }
      } catch (e) {
        if (mounted) {
          setError(`Errors: ${JSON.stringify(e)}`);
          console.error(`Failed setting up nostr client ${e}`);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initNostr();

    return () => {
      mounted = false;
      if (currentClient) {
        currentClient.disconnect();
      }
    };
  }, [secretKey]); // Only depend on secretKey;

  const publishNote = useCallback(async (receiver: PublicKey, room: PublicKey, content: string) => {
    if (!client || !keys) {
      throw new Error("Nostr client not initialized");
    }

    try {
      return await client.sendPrivateMsg(receiver, content, [Tag.publicKey(room)]);
    } catch (e) {
      throw new Error(`Failed to publish note: ${e}`);
    }
  }, [client, keys]);

  const fetchChatMessages = useCallback(
    async (sender: PublicKey, receiver: PublicKey, chatRoom: PublicKey, callback: (event: ChatMessage) => void) => {
      if (!client || !keys) {
        console.log("Error client not set");
        return;
      }
      const unwrappedEvents: ChatMessage[] = [];

      {
        // fetch events to sender, i.e. to yourself
        const filter = new Filter().kind(new Kind(1059)).customTag(
          SingleLetterTag.lowercase(Alphabet.P),
          sender.toHex(),
        );
        const events = await client.fetchEvents(filter, Duration.fromSecs(5));

        for (const event of events.toVec()) {
          try {
            const unwrappedGift = await client.unwrapGiftWrap(event);
            if (
              unwrappedGift.rumor.tags.find((t) => {
                return t.content() === chatRoom.toHex();
              })
            ) {
              unwrappedEvents.push({
                eventId: event.id,
                sender: unwrappedGift.rumor.pubkey.toBech32(),
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

      {
        // fetch events to receiver, i.e. to the other party
        const filter = new Filter().kind(new Kind(1059)).customTag(
          SingleLetterTag.lowercase(Alphabet.P),
          receiver.toHex(),
        );
        const events = await client.fetchEvents(filter, Duration.fromSecs(5));

        for (const event of events.toVec()) {
          try {
            const unwrappedGift = await client.unwrapGiftWrap(event);

            if (
              unwrappedGift.rumor.tags.find((t) => {
                return t.content() === chatRoom.toHex();
              })
            ) {
              unwrappedEvents.push({
                eventId: event.id,
                sender: unwrappedGift.rumor.pubkey.toBech32(),
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

      for (const event of unwrappedEvents) {
        callback(event);
      }
    },
    [client, keys],
  );

  const subscribe = useCallback(
    async (sender: PublicKey, id: string, chatRoom: PublicKey, callback: (event: ChatMessage) => void) => {
      if (!client || !publicKey || !keys) {
        throw new Error("Nostr client not initialized");
      }

      const handle = { // Handle event
        handleEvent: async (relayUrl: string, subscriptionId: string, event: Event) => {
          console.log(
            `Received new event from ${relayUrl} with subscription id ${subscriptionId} and kind ${event.kind.asU16()}`,
          );

          if (event.kind.asU16() === new Kind(1059).asU16()) {
            const unwrappedGift = await client.unwrapGiftWrap(event);
            if (
              unwrappedGift.rumor.tags.find((t) => {
                return t.content() === chatRoom.toHex();
              })
            ) {
              callback({
                sender: unwrappedGift.rumor.pubkey.toBech32(),
                content: unwrappedGift.rumor.content,
                createdAt: unwrappedGift.rumor.createdAt,
                tags: unwrappedGift.rumor.tags,
                eventId: event.id,
              });
            }
          }
          return false;
        },
        // Handle relay message
        handleMsg: async (_relayUrl: string, _message: RelayMessage) => {
          return false;
        },
      };

      const filter = new Filter()
        .kind(new Kind(1059))
        .customTag(SingleLetterTag.lowercase(Alphabet.P), sender.toHex());
      await client.subscribeWithId(id, filter);

      client.handleNotifications(handle);
    },
    [client, publicKey, keys],
  );

  const unsubscribeWithId = useCallback(async (id: string) => {
    if (!client || !publicKey || !keys) {
      throw new Error("Nostr client not initialized");
    }
    console.log(`Unsubscribing subscription with id: ${id}`);
    await client.unsubscribe(id);
  }, [client, publicKey, keys]);
  return {
    client,
    publicKey,
    isLoading,
    error,
    publishNote,
    fetchChatMessages,
    subscribe,
    unsubscribeWithId,
  };
}
