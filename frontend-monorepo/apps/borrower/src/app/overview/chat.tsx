import { LuSend } from "react-icons/lu";
import React, { useState } from "react";
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

// Sample chat messages
const chatMessages = [
  {
    id: 1,
    sender: "lender",
    name: "Alice",
    message: "I've reviewed your loan request. The terms look acceptable.",
    time: "2025-02-02 14:32",
  },
  {
    id: 2,
    sender: "borrower",
    name: "You",
    message:
      "Thanks for the quick response. I'll deposit the collateral within 24 hours.",
    time: "2025-02-02 15:01",
  },
  {
    id: 3,
    sender: "lender",
    name: "Alice",
    message: "Great, I'll release the funds once the collateral is confirmed.",
    time: "2025-02-02 15:08",
  },
  {
    id: 4,
    sender: "system",
    message: "Collateral of 0.03842120 BTC has been confirmed",
    time: "2025-02-05 09:15",
  },
  {
    id: 5,
    sender: "lender",
    name: "Alice",
    message:
      "I see the collateral has been received. Sending the $11 USDC now.",
    time: "2025-02-06 11:20",
  },
  {
    id: 6,
    sender: "system",
    message: "Principal amount of $11 USDC has been sent",
    time: "2025-02-07 10:45",
  },
  {
    id: 7,
    sender: "borrower",
    name: "You",
    message: "Got it, thank you! The loan is now active.",
    time: "2025-02-07 11:02",
  },
];

export const Chat = () => {
  const [chatMessage, setChatMessage] = useState("");

  const handleSendMessage = () => {
    if (chatMessage.trim()) {
      // Here you would usually send the message to an API
      // For this demo, we'll just clear the input
      setChatMessage("");
    }
  };

  return (
    <Card className="shadow-md h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Communication Channel</CardTitle>
        <CardDescription>Chat with the other party</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden p-0">
        <ScrollArea className="h-[400px] p-4">
          {chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={`mb-4 ${msg.sender === "system" ? "px-4" : ""}`}
            >
              {msg.sender === "system" ? (
                <div className="bg-gray-100 rounded-md p-2 text-xs text-center text-gray-600">
                  {msg.message} • {msg.time}
                </div>
              ) : (
                <div
                  className={`flex ${msg.sender === "borrower" ? "justify-end" : "justify-start"}`}
                >
                  {msg.sender === "lender" && (
                    <Avatar className="h-8 w-8 mr-2">
                      <AvatarFallback>{msg.name[0]}</AvatarFallback>
                    </Avatar>
                  )}
                  <div>
                    <div
                      className={`rounded-lg p-3 max-w-xs ${
                        msg.sender === "borrower"
                          ? "bg-black text-white ml-2"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      <p className="text-sm">{msg.message}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{msg.time}</p>
                  </div>
                  {msg.sender === "borrower" && (
                    <Avatar className="h-8 w-8 ml-2">
                      <AvatarFallback>Y</AvatarFallback>
                    </Avatar>
                  )}
                </div>
              )}
            </div>
          ))}
        </ScrollArea>
      </CardContent>
      <CardFooter className="border-t p-4">
        <div className="flex w-full">
          <Input
            placeholder="Type your message..."
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            className="rounded-r-none"
          />
          <Button
            onClick={handleSendMessage}
            className="rounded-l-none bg-black hover:bg-gray-800"
          >
            <LuSend className="h-4 w-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};
