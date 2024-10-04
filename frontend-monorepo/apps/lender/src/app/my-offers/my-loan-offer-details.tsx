import { faWarning } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { LoanOffer, LoanOfferStatus, useLenderHttpClient } from "@frontend-monorepo/http-client-lender";
import { formatCurrency, StableCoin, StableCoinHelper } from "@frontend-monorepo/ui-shared";
import { Box, Button, Callout, Flex, Grid, Heading, Separator, Text } from "@radix-ui/themes";
import React, { Suspense, useState } from "react";
import { IoIosArrowRoundBack } from "react-icons/io";
import { Await, Link, useParams } from "react-router-dom";
import { StatusBadge } from "./status-badge";

function MyLoanOfferDetails() {
  const { getMyLoanOffer, deleteLoanOffer } = useLenderHttpClient();
  const { id } = useParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const layout = window;

  const onDeleteOffer = async (id: string) => {
    setLoading(true);
    try {
      await deleteLoanOffer(id);
    } catch (error) {
      setError(`${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Suspense>
      <Await
        resolve={getMyLoanOffer(id!)}
        errorElement={<div>Could not load offer</div>}
        children={(offer: Awaited<LoanOffer>) => {
          const initCoin = StableCoinHelper.mapFromBackend(offer.loan_asset_chain, offer.loan_asset_type);

          let coinLabel = "";
          switch (initCoin) {
            case StableCoin.USDT_SN:
              coinLabel = "USDT - Starknet";
              break;
            case StableCoin.USDT_ETH:
              coinLabel = "USDT - Ethereum";
              break;
            case StableCoin.USDC_SN:
              coinLabel = "USDC - Starknet";
              break;
            case StableCoin.USDC_ETH:
              coinLabel = "USDC - Ethereum";
              break;
          }

          return (
            <Box
              className="overflow-y-scroll p-3 pb-16 md:p-5 lg:p-8"
              style={{
                height: layout.innerHeight - 65,
              }}
            >
              <Grid className="md:grid-cols-4 lg:grid-cols-5 gap-5 items-center">
                <Box className="md:col-span-2 lg:col-span-3">
                  <Box className="flex items-center gap-3">
                    <Link to="/my-offers">
                      <IoIosArrowRoundBack size={30} />
                    </Link>
                    <Heading size={"8"} className="text-font-dark">Details</Heading>
                  </Box>
                  <Box mt={"7"}>
                    <Box mt={"4"} className="border border-font/20 rounded-lg p-4 md:p-6 space-y-5">
                      <Flex justify={"between"} align={"center"}>
                        <Text as="label" size={"2"} weight={"medium"}>Status</Text>
                        <Text className="text-[13px] font-semibold text-black/70 capitalize">
                          {<StatusBadge offer={offer} />}
                        </Text>
                      </Flex>
                      <Separator size={"4"} />
                      <Flex justify={"between"} align={"center"}>
                        <Text as="label" size={"2"} weight={"medium"}>Amount</Text>
                        <Text className="text-[13px] font-semibold text-black/70 capitalize">
                          {formatCurrency(offer.loan_amount_min)} - {formatCurrency(offer.loan_amount_max)}
                        </Text>
                      </Flex>
                      <Separator size={"4"} />
                      <Flex justify={"between"} align={"center"}>
                        <Text as="label" size={"2"} weight={"medium"}>Loan Duration</Text>
                        <Text className="text-[13px] font-semibold text-black/70 capitalize">
                          {offer.duration_months_min} - {offer.duration_months_max} Months
                        </Text>
                      </Flex>
                      <Separator size={"4"} />
                      <Flex justify={"between"} align={"center"}>
                        <Text as="label" size={"2"} weight={"medium"}>APR</Text>
                        <Text className="text-[13px] font-semibold text-black/70 capitalize">
                          {(offer.interest_rate * 100).toFixed(2)}%
                        </Text>
                      </Flex>
                      <Separator size={"4"} />
                      <Flex justify={"between"} align={"center"}>
                        <Text as="label" size={"2"} weight={"medium"}>Stable coin</Text>
                        <Text className="text-[13px] font-semibold text-black/70 capitalize">
                          {coinLabel}
                        </Text>
                      </Flex>
                    </Box>
                  </Box>
                </Box>

                <Box px={"2"} className="md:col-span-2">
                  {error
                    ? (
                      <Callout.Root color="red" className="w-full">
                        <Callout.Icon>
                          <FontAwesomeIcon icon={faWarning} />
                        </Callout.Icon>
                        <Callout.Text>
                          {error}
                        </Callout.Text>
                      </Callout.Root>
                    )
                    : ""}
                </Box>
              </Grid>
              {offer.status !== LoanOfferStatus.Deleted
                && (
                  <Button
                    loading={loading}
                    disabled={loading}
                    onClick={() => onDeleteOffer(offer.id)}
                  >
                    Delete Offer
                  </Button>
                )}
            </Box>
          );
        }}
      />
    </Suspense>
  );
}

export default MyLoanOfferDetails;
