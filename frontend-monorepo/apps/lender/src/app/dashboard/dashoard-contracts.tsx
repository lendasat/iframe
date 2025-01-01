import { Contract, useLenderHttpClient } from "@frontend-monorepo/http-client-lender";
import { Box, Button, Heading, Tabs, Text } from "@radix-ui/themes";
import React, { Suspense, useState } from "react";
import { Await } from "react-router-dom";
import { useAsync } from "react-use";
import { AllContracts } from "../contracts/all-contracts";

interface TabHeaderProps {
  thisIndex: string;
  label: string;
}

function TabHeader({ thisIndex, label }: TabHeaderProps) {
  return (
    <Tabs.Trigger
      className={`text-[13px] font-medium px-6 max-h-9 rounded-lg bg-transparent text-font/60 dark:text-font-dark/60"
      data-[state=active]:bg-purple-800
      data-[state=active]:text-white
      data-[state=inactive]:dark:text-gray-400
      data-[state=active]:dark:text-white
      }`}
      value={thisIndex}
    >
      <Text
        size={"2"}
        weight={"medium"}
        className={`break-all`}
      >
        {label}
      </Text>
    </Tabs.Trigger>
  );
}

export interface DashboardContractsProps {
  contracts: Contract[];
}

export default function DashboardContracts({ contracts }: DashboardContractsProps) {
  return (
    <Box className="space-y-3">
      <Tabs.Root defaultValue="open" className={"flex flex-col"}>
        <Box className="space-y-2 flex items-center justify-between flex-wrap">
          <Heading className="text-black dark:text-white">
            Contracts
          </Heading>
          <Tabs.List
            className="bg-white dark:bg-dark-500 flex items-center gap-1 p-1 rounded-xl border dark:border-dark-600 shrink-0 "
            color={undefined}
          >
            <TabHeader thisIndex={"actionRequired"} label={"Action Required"} />
            <TabHeader thisIndex={"open"} label={"Open"} />
            <TabHeader thisIndex={"closed"} label={"Closed"} />
          </Tabs.List>
        </Box>

        <Box className="max-h-96 rounded-xl overflow-auto">
          <Tabs.Content value="actionRequired">
            <AllContracts
              header
              contracts={[]}
            />
          </Tabs.Content>
          <Tabs.Content value="open">
            <AllContracts
              header
              contracts={contracts}
            />
          </Tabs.Content>

          <Tabs.Content value="closed">
            <AllContracts
              header
              contracts={contracts}
            />
          </Tabs.Content>
        </Box>
      </Tabs.Root>
    </Box>
  );
}
