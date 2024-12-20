import type { LoanOffer } from "@frontend-monorepo/http-client-borrower";
import { CurrencyFormatter, StableCoinHelper } from "@frontend-monorepo/ui-shared";
import { Badge, Box, Button, DropdownMenu, Flex, Grid, Heading, Text } from "@radix-ui/themes";
import { BsThreeDotsVertical } from "react-icons/bs";
import { Lender } from "./lender";

interface LoanOfferProps {
  loanOffer: LoanOffer;
  onRequest: (loanOffer: LoanOffer) => void;
}

export function LoanOfferComponent({ loanOffer, onRequest }: LoanOfferProps) {
  const coin = StableCoinHelper.mapFromBackend(loanOffer.loan_asset_chain, loanOffer.loan_asset_type);
  return (
    <Box className="pl-5 pr-6 md:pl-7 md:pr-8 py-3 border-b border-black/5 flex md:gap-2 items-center dark:border-dark">
      <Grid className="grid-cols-4 md:grid-cols-6 xl:grid-cols-7 items-center grow text-font dark:text-font-dark">
        <Box className="col-span-1 xl:col-span-2">
          <Lender {...loanOffer.lender} />
        </Box>
        <Box className="flex justify-center col-span-2 md:col-span-1">
          <Text className={"text-font dark:text-font-dark"} size={"1"} weight={"medium"}>
            <CurrencyFormatter value={loanOffer.loan_amount_min} /> -{" "}
            <CurrencyFormatter value={loanOffer.loan_amount_max} />
          </Text>
        </Box>

        <Box className="hidden md:flex justify-center">
          <Text className={"text-font dark:text-font-dark"} size={"1"} weight={"medium"}>
            {loanOffer.duration_months_min} - {loanOffer.duration_months_max} months
          </Text>
        </Box>

        <Box className="hidden md:flex justify-center">
          <Text className={"text-font dark:text-font-dark"} size={"1"} weight={"medium"}>
            {(loanOffer.min_ltv * 100).toFixed(2)}%
          </Text>
        </Box>

        <Box className="flex justify-center">
          <Text className={"text-font dark:text-font-dark"} size={"1"} weight={"medium"}>
            {(loanOffer.interest_rate * 100).toFixed(2)}%
          </Text>
        </Box>

        <Box className="hidden md:flex justify-center">
          <Text className={"text-font dark:text-font-dark"} size={"1"} weight={"medium"}>
            <Badge color="purple" size={"2"}>{coin ? StableCoinHelper.print(coin) : "unknown"}</Badge>
          </Text>
        </Box>
      </Grid>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          <Button variant="ghost" className="xl:hidden text-font dark:text-font-dark hover:bg-transparent">
            <BsThreeDotsVertical />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content className={"bg-light dark:bg-dark"}>
          <Box width={"100%"} minWidth={"300px"} p={"3"}>
            <Heading className={"text-font dark:text-font-dark"} as="h6" weight={"medium"}>
              More Information
            </Heading>
          </Box>
          <DropdownMenu.Separator />
          <Box width={"100%"} minWidth={"300px"} p={"3"}>
            <Flex direction={"column"} gap={"4"} align={"start"}>
              <Box>
                <Flex align={"center"} gap={"3"}>
                  <Text className={"text-font dark:text-font-dark"} size={"3"} weight={"medium"}>
                    From:
                  </Text>
                  <Text className="capitalize text-font dark:text-font-dark" size={"3"}>
                    {loanOffer.lender.name}
                  </Text>
                </Flex>
              </Box>
              <Box>
                <Flex align={"center"} gap={"3"}>
                  <Text className={"text-font dark:text-font-dark"} size={"3"} weight={"medium"}>
                    Amount:
                  </Text>
                  <Text className="capitalize text-font dark:text-font-dark" size={"3"}>
                    <CurrencyFormatter value={loanOffer.loan_amount_min} /> -{" "}
                    <CurrencyFormatter value={loanOffer.loan_amount_max} />
                  </Text>
                </Flex>
              </Box>
              <Box>
                <Flex align={"center"} gap={"3"}>
                  <Text className={"text-font dark:text-font-dark"} size={"3"} weight={"medium"}>
                    Duration:
                  </Text>
                  <Text className="capitalize text-font dark:text-font-dark" size={"3"}>
                    {loanOffer.duration_months_min} - {loanOffer.duration_months_max} months
                  </Text>
                </Flex>
              </Box>
              <Box>
                <Flex align={"center"} gap={"3"}>
                  <Text className={"text-font dark:text-font-dark"} size={"3"} weight={"medium"}>
                    LTV rate:
                  </Text>
                  <Text className="capitalize text-font dark:text-font-dark" size={"3"}>
                    {(loanOffer.min_ltv * 100).toFixed(2)}%
                  </Text>
                </Flex>
              </Box>
              <Box>
                <Flex align={"center"} gap={"3"}>
                  <Text className={"text-font dark:text-font-dark"} size={"3"} weight={"medium"}>
                    Interest:
                  </Text>
                  <Text className="capitalize text-font dark:text-font-dark" size={"3"}>
                    {(loanOffer.interest_rate * 100).toFixed(2)}%
                  </Text>
                </Flex>
              </Box>
              <Box>
                <Flex align={"center"} gap={"3"}>
                  <Text className={"text-font dark:text-font-dark"} size={"3"} weight={"medium"}>
                    Coin:
                  </Text>
                  <Text className="capitalize text-font dark:text-font-dark" size={"3"}>
                    <Badge color="purple" size={"2"}>{StableCoinHelper.print(coin)}</Badge>
                  </Text>
                </Flex>
              </Box>
            </Flex>
          </Box>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </Box>
  );
}
