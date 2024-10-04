import { LoanOffer } from "@frontend-monorepo/http-client-lender";
import { CurrencyFormatter, StableCoinHelper } from "@frontend-monorepo/ui-shared";
import { Badge, Box, Button, DropdownMenu, Flex, Grid, Heading, Text } from "@radix-ui/themes";
import React from "react";
import { BsThreeDotsVertical } from "react-icons/bs";
import { useNavigate } from "react-router-dom";
import { StatusBadge } from "./status-badge";

interface LoanOfferProps {
  loanOffer: LoanOffer;
}

export function MyLoanOfferComponent({ loanOffer }: LoanOfferProps) {
  const coin = StableCoinHelper.mapFromBackend(loanOffer.loan_asset_chain, loanOffer.loan_asset_type)!;

  const navigate = useNavigate();

  return (
    <Box className="pl-5 pr-6 md:pl-7 md:pr-8 py-3 border-b border-black/5 flex md:gap-2 items-center">
      <Grid className="grid-cols-4 md:grid-cols-6 xl:grid-cols-8 items-center grow text-font">
        <Box className="flex justify-center col-span-2 md:col-span-1">
          <Text size={"1"} weight={"medium"}>
            <CurrencyFormatter value={loanOffer.loan_amount_min} /> -{" "}
            <CurrencyFormatter value={loanOffer.loan_amount_max} />
          </Text>
        </Box>

        <Box className="hidden md:flex justify-center">
          <Text size={"1"} weight={"medium"}>
            {loanOffer.duration_months_min} - {loanOffer.duration_months_max} months
          </Text>
        </Box>

        <Box className="hidden md:flex justify-center">
          <Text size={"1"} weight={"medium"}>
            {(loanOffer.min_ltv * 100).toFixed(2)}%
          </Text>
        </Box>

        <Box className="flex justify-center">
          <Text size={"1"} weight={"medium"}>
            {(loanOffer.interest_rate * 100).toFixed(2)}%
          </Text>
        </Box>

        <Box className="hidden md:flex justify-center">
          <Text size={"1"} weight={"medium"}>
            <Badge color="purple" size={"2"}>{StableCoinHelper.print(coin)}</Badge>
          </Text>
        </Box>

        <Box className="hidden md:flex justify-center">
          <Text size={"1"} weight={"medium"}>
            <StatusBadge offer={loanOffer} />
          </Text>
        </Box>
        <Box className="hidden xl:flex justify-center">
          <Button
            size={"3"}
            variant="solid"
            className="bg-btn text-white"
            onClick={() => {
              navigate(`/my-offers/${loanOffer.id}`);
            }}
          >
            <Text
              size={"2"}
              className="font-semibold"
            >
              Details
            </Text>
          </Button>
        </Box>
      </Grid>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          <Button variant="ghost" className="xl:hidden text-font hover:bg-transparent">
            <BsThreeDotsVertical />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <Box width={"100%"} minWidth={"300px"} p={"3"}>
            <Heading as="h6" weight={"medium"}>
              More Information
            </Heading>
          </Box>
          <DropdownMenu.Separator />
          <Box width={"100%"} minWidth={"300px"} p={"3"}>
            <Flex direction={"column"} gap={"4"} align={"start"}>
              <Box>
                <Flex align={"center"} gap={"3"}>
                  <Text size={"3"} weight={"medium"}>
                    From:
                  </Text>
                  <Text className="capitalize" size={"3"}>
                    {loanOffer.id}
                  </Text>
                </Flex>
              </Box>
              <Box>
                <Flex align={"center"} gap={"3"}>
                  <Text size={"3"} weight={"medium"}>
                    Amount:
                  </Text>
                  <Text className="capitalize" size={"3"}>
                    <CurrencyFormatter value={loanOffer.loan_amount_min} /> -{" "}
                    <CurrencyFormatter value={loanOffer.loan_amount_max} />
                  </Text>
                </Flex>
              </Box>
              <Box>
                <Flex align={"center"} gap={"3"}>
                  <Text size={"3"} weight={"medium"}>
                    Duration:
                  </Text>
                  <Text className="capitalize" size={"3"}>
                    {loanOffer.duration_months_min} - {loanOffer.duration_months_max} months
                  </Text>
                </Flex>
              </Box>
              <Box>
                <Flex align={"center"} gap={"3"}>
                  <Text size={"3"} weight={"medium"}>
                    LTV rate:
                  </Text>
                  <Text className="capitalize" size={"3"}>
                    {(loanOffer.min_ltv * 100).toFixed(2)}%
                  </Text>
                </Flex>
              </Box>
              <Box>
                <Flex align={"center"} gap={"3"}>
                  <Text size={"3"} weight={"medium"}>
                    Interest:
                  </Text>
                  <Text className="capitalize" size={"3"}>
                    {(loanOffer.interest_rate * 100).toFixed(2)}%
                  </Text>
                </Flex>
              </Box>
              <Box>
                <Flex align={"center"} gap={"3"}>
                  <Text size={"3"} weight={"medium"}>
                    Coin:
                  </Text>
                  <Text className="capitalize" size={"3"}>
                    <Badge color="purple" size={"2"}>{StableCoinHelper.print(coin)}</Badge>
                  </Text>
                </Flex>
              </Box>
              <Box>
                <Flex align={"center"} gap={"3"}>
                  <Text size={"3"} weight={"medium"}>
                    Status:
                  </Text>
                  <Text className="capitalize" size={"3"}>
                    <StatusBadge offer={loanOffer} />
                  </Text>
                </Flex>
              </Box>
              <Button
                size={"3"}
                variant="solid"
                className="bg-btn text-white w-full active:scale-90"
                onClick={() => {
                  navigate(`/my-offers/${loanOffer.id}`);
                }}
              >
                <Text
                  size={"2"}
                  className="font-semibold"
                >
                  Details
                </Text>
              </Button>
            </Flex>
          </Box>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </Box>
  );
}
