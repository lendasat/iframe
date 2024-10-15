import { Box, Flex, Heading, Text, Tooltip } from "@radix-ui/themes";
import React, { useEffect, useState } from "react";
import { LuClock1 } from "react-icons/lu";
import { PiWarningCircleBold } from "react-icons/pi";

interface ContractRequestedProps {
  createdAt: Date;
}

export function ContractRequested({ createdAt }: ContractRequestedProps) {
  const [timeRemaining, setTimeRemaining] = useState("");

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const expiryTime = new Date(createdAt.getTime() + 12 * 60 * 60 * 1000); // createdAt + 12 hours
      const diff = expiryTime.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining("Expired");
        clearInterval(timer);
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        setTimeRemaining(
          `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${
            seconds.toString().padStart(2, "0")
          }`,
        );
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [createdAt]);

  return (
    <Box>
      <Heading weight={"medium"} size={"4"}>Awaiting Lenders Remark...</Heading>
      <Box className="mt-3 h-12 px-2 justify-between rounded-xl bg-gradient-to-r from-pink-500/20 to-active-nav/50 to-90% flex items-center">
        <Flex align={"center"} gap={"2"}>
          <Box className="h-8 w-8 bg-black rounded-lg flex items-center justify-center">
            <LuClock1 color="white" size={17} />
          </Box>
          <Text weight={"medium"} size={"2"}>
            Time Remaining
          </Text>
        </Flex>
        <Flex align={"center"} gap={"2"}>
          <Heading size={"3"}>
            {timeRemaining}
          </Heading>
          <Tooltip content={"Waiting for the lenders response"}>
            <PiWarningCircleBold />
          </Tooltip>
        </Flex>
      </Box>
    </Box>
  );
}
