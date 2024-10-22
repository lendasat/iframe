import { faWarning } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { LoanOffer } from "@frontend-monorepo/http-client-lender";
import { LoanOfferStatus, useLenderHttpClient } from "@frontend-monorepo/http-client-lender";
import { formatCurrency, StableCoin, StableCoinHelper } from "@frontend-monorepo/ui-shared";
import { Box, Button, Callout, Dialog, Flex, Grid, Heading, Separator, Text, TextField } from "@radix-ui/themes";
import { Suspense, useState } from "react";
import { FaPenNib } from "react-icons/fa";
import { IoReceipt } from "react-icons/io5";
import { MdOutlineSwapCalls } from "react-icons/md";
import { Await, useParams } from "react-router-dom";
import BannerImg from "./../../assets/banner.png";
import LendasatLogo from "./../../assets/lendasat.png";
import ReceipImg from "./../../assets/receipt_img.png";
import type { LoanAmount, LoanDuration } from "../create-loan-offer";
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

  // Edit loan Information

  //  Should be replaced with the current offer values
  const [loanAmount, setLoanAmount] = useState<LoanAmount>({
    min: 1000,
    max: 10000,
  });
  const [loanDuration, setLoanDuration] = useState<LoanDuration>({
    min: 3,
    max: 18,
  });
  const [ltv, setLtv] = useState<number>(0.5);
  const [interest, setInterest] = useState<number>(0.3);
  // const [isLoading, setIsLoading] = useState(false);

  return (
    <Suspense>
      <Await
        resolve={async () => {
          if (id == null) {
            return Promise.reject(new Error("Cannot load offer without ID"));
          }
          return getMyLoanOffer(id);
        }}
        errorElement={
          <Box
            className="flex flex-col items-center justify-center gap-y-4 px-5 text-center"
            style={{
              height: layout.innerHeight - 130,
            }}
          >
            <Box className="rounded-full bg-white h-52 w-52 overflow-hidden flex items-center justify-center">
              <img src={ReceipImg} alt="credit card" className="max-w-52" />
            </Box>
            <Text className="text-font/50" size={"2"}>An Error Occurred...</Text>
          </Box>
        }
        children={(offer: Awaited<LoanOffer>) => {
          const initCoin = StableCoinHelper.mapFromBackend(
            offer.loan_asset_chain,
            offer.loan_asset_type,
          );

          let coinLabel = "";
          switch (initCoin) {
            case StableCoin.USDT_SN:
              coinLabel = "USDT - Starknet";
              break;
            case StableCoin.USDT_POL:
              coinLabel = "USDT - Polygon";
              break;
            case StableCoin.USDT_ETH:
              coinLabel = "USDT - Ethereum";
              break;
            case StableCoin.USDC_SN:
              coinLabel = "USDC - Starknet";
              break;
            case StableCoin.USDC_POL:
              coinLabel = "USDC - Polygon";
              break;
            case StableCoin.USDC_ETH:
              coinLabel = "USDC - Ethereum";
              break;
          }

          return (
            <Box
              className="overflow-y-scroll pb-20 md:pb-0"
              style={{
                height: layout.innerHeight - 130,
              }}
            >
              <Grid className="md:grid-cols-2 gap-y-5 items-center min-h-full">
                <Box py={"4"} className="px-4 xl:px-8 space-y-5 order-2 md:order-1">
                  <Box className="h-32 rounded-2xl bg-purple-100 overflow-hidden">
                    <img
                      src={BannerImg}
                      alt="Banner Information"
                      className="h-full w-full object-contain object-center"
                    />
                  </Box>

                  <Flex align={"center"} gap={"2"}>
                    <FaPenNib className="text-font-dark" />
                    <Heading size={"5"} className="text-font-dark">
                      Edit Loan
                    </Heading>
                  </Flex>

                  <Box className="space-y-5">
                    {/* Amount */}
                    <Box className="space-y-1">
                      <Text as="label" size={"2"} weight={"medium"} className="text-font/60">
                        Amount
                      </Text>
                      <Flex align={"center"} gap={"15px"}>
                        <TextField.Root
                          size="3"
                          color="purple"
                          className="flex-1 text-sm rounded-lg"
                          type="number"
                          placeholder="Min Amount"
                          value={loanAmount.min}
                          disabled={true}
                          onChange={(e) => setLoanAmount({ ...loanAmount, min: Number(e.target.value) })}
                        />

                        <MdOutlineSwapCalls />

                        <TextField.Root
                          size="3"
                          type="number"
                          className="flex-1 text-sm rounded-lg"
                          color="purple"
                          placeholder="Max Amount"
                          value={loanAmount.max}
                          variant="surface"
                          disabled={true}
                          onChange={(e) => setLoanAmount({ ...loanAmount, max: Number(e.target.value) })}
                        />
                      </Flex>
                    </Box>

                    {/* Duration */}
                    <Box className="space-y-1">
                      <Text as="label" size={"2"} weight={"medium"} className="text-font/60">
                        Duration
                      </Text>
                      <Text as="span" className="text-font/50" weight={"medium"} size={"1"}>(months)</Text>
                      <Flex align={"center"} gap={"15px"}>
                        <TextField.Root
                          size="3"
                          className="flex-1 text-sm rounded-lg"
                          type="number"
                          color="purple"
                          placeholder="Min Duration"
                          value={loanDuration.min}
                          disabled={true}
                          onChange={(e) => setLoanDuration({ ...loanDuration, min: Number(e.target.value) })}
                        />

                        <MdOutlineSwapCalls />

                        <TextField.Root
                          size="3"
                          type="number"
                          color="purple"
                          className="flex-1 text-sm rounded-lg"
                          placeholder="Max Duration"
                          value={loanDuration.max}
                          disabled={true}
                          onChange={(e) => setLoanDuration({ ...loanDuration, max: Number(e.target.value) })}
                        />
                      </Flex>
                    </Box>

                    {/* Interest Rate */}
                    <Box className="space-y-1">
                      <Text as="label" size={"2"} weight={"medium"} className="text-font/60">
                        Interest Rate
                      </Text>
                      <TextField.Root
                        size="3"
                        className="flex-1 text-sm rounded-lg"
                        type="number"
                        placeholder="Interest Rate"
                        color="purple"
                        value={interest}
                        min={0}
                        max={1}
                        step={0.01}
                        disabled={true}
                        onChange={(e) => setInterest(Number(e.target.value))}
                      >
                        <TextField.Slot className="pr-0" />
                        <TextField.Slot>
                          <Text size={"2"} weight={"medium"}>0.0 - 1.0</Text>
                        </TextField.Slot>
                      </TextField.Root>
                    </Box>

                    {/* LTV */}
                    <Box className="space-y-1">
                      <Text as="label" size={"2"} weight={"medium"} className="text-font/60">
                        Loan to value
                      </Text>
                      <TextField.Root
                        size="3"
                        className="flex-1 text-sm rounded-lg"
                        type="number"
                        placeholder="LTV (0-1)"
                        color="purple"
                        value={ltv}
                        min={0}
                        max={0.9}
                        step={0.1}
                        disabled={true}
                        onChange={(e) => setLtv(Number(e.target.value))}
                      >
                        <TextField.Slot className="pr-0" />
                        <TextField.Slot>
                          <Text size={"2"} weight={"medium"}>0.1 - 0.9</Text>
                        </TextField.Slot>
                      </TextField.Root>
                    </Box>

                    <Flex align={"center"} justify={"start"}>
                      {/*TODO: implement update*/}
                      {/*<Button*/}
                      {/*  loading={isLoading}*/}
                      {/*  size={"3"}*/}
                      {/*  color="purple"*/}
                      {/*  disabled={loanAmount.max !== offer.loan_amount_max*/}
                      {/*      || loanAmount.min !== offer.loan_amount_min*/}
                      {/*      || loanDuration.max !== offer.duration_months_max*/}
                      {/*      || loanDuration.min !== offer.duration_months_min*/}
                      {/*      || interest !== offer.interest_rate*/}
                      {/*      || ltv !== offer.min_ltv*/}
                      {/*    ? false*/}
                      {/*    : true}*/}
                      {/*  onClick={() => {*/}
                      {/*    setIsLoading(true);*/}
                      {/*    setTimeout(() => {*/}
                      {/*      setIsLoading(false);*/}
                      {/*    }, 1000);*/}
                      {/*  }}*/}
                      {/*>*/}
                      {/*  <Text weight={"medium"} size={"2"}>Update Changes</Text>*/}
                      {/*</Button>*/}
                    </Flex>
                  </Box>
                </Box>
                <Box className="p-5 xl:h-full flex flex-col items-center justify-center order-1 md:order-2">
                  <Box className="bg-white flex-1 flex flex-col w-full rounded-2xl border border-font/10 p-2 xl:p-4">
                    <Flex align={"center"} justify={"between"} className="pb-4 px-3">
                      {/* Title */}
                      <Flex align={"center"} gap={"2"}>
                        <IoReceipt className="text-font-dark" />
                        <Heading size={"5"} className="text-font-dark">
                          Loan Preview
                        </Heading>
                      </Flex>

                      {/* Export: TODO: implement */}
                      {/*<Tooltip content="Download Preview" className="font-medium">*/}
                      {/*  <Button className="hover:bg-transparent" variant="ghost">*/}
                      {/*    <FaFileExport className="text-font" />*/}
                      {/*    <Text as="span" size={"2"} weight={"medium"} className="text-font">*/}
                      {/*      Export*/}
                      {/*    </Text>*/}
                      {/*  </Button>*/}
                      {/*</Tooltip>*/}
                    </Flex>

                    <Box className="bg-gradient-to-tr from-60% to-100% from-[#FBFAF8] to-pink-700/5 p-6 rounded-2xl flex items-center justify-center flex-1">
                      <Box className="space-y-6 min-w-[300px] w-full max-w-sm bg-white rounded-xl py-7">
                        <Flex align={"start"} justify={"between"} mb="8" className="px-4 md:px-5">
                          {/* Logo */}
                          <Box>
                            <img
                              src={LendasatLogo}
                              alt="Lendasat Logo"
                              className="h-4 w-auto shrink-0 "
                            />
                          </Box>

                          <StatusBadge offer={offer} />
                        </Flex>
                        {/* Created date */}
                        <Flex align={"center"} justify={"end"} gap={"2"} className="px-4 md:px-5">
                          <Text as="label" size={"1"} weight={"medium"}>
                            Created on:
                          </Text>
                          <Text as="p" size={"1"} weight={"medium"}>
                            {new Date(offer.created_at).toLocaleDateString()}
                          </Text>
                        </Flex>

                        <Box className="px-3 md:px-5">
                          <Box className="mb-2 pl-3">
                            <Text className="text-font/80 font-medium">Details</Text>
                          </Box>
                          <Box className="border border-font/10 space-y-5 p-4 rounded-xl py-6">
                            {/* Amount */}
                            <Flex justify={"between"} align={"center"}>
                              <Text as="label" size={"2"} weight={"medium"} className="text-font/70">
                                Amount
                              </Text>
                              <Text className="text-[13px] font-semibold text-black/70 capitalize">
                                {formatCurrency(offer.loan_amount_min)} - {formatCurrency(offer.loan_amount_max)}
                              </Text>
                            </Flex>
                            <Separator size={"4"} className="bg-font/10" />
                            {/* Duration */}
                            <Flex justify={"between"} align={"center"}>
                              <Text as="label" size={"2"} weight={"medium"} className="text-font/70">
                                Loan Duration
                              </Text>
                              <Text className="text-[13px] font-semibold text-black/70 capitalize">
                                {offer.duration_months_min} - {offer.duration_months_max} Months
                              </Text>
                            </Flex>
                            <Separator size={"4"} className="bg-font/10" />
                            {/* Interest */}
                            <Flex justify={"between"} align={"center"}>
                              <Text as="label" size={"2"} weight={"medium"} className="text-font/70">
                                APR
                              </Text>
                              <Text className="text-[13px] font-semibold text-black/70 capitalize">
                                {(offer.interest_rate * 100).toFixed(2)}%
                              </Text>
                            </Flex>
                            <Separator size={"4"} className="bg-font/10" />
                            {/* Ltv */}
                            <Flex justify={"between"} align={"center"}>
                              <Text as="label" size={"2"} weight={"medium"} className="text-font/70">
                                LTV
                              </Text>
                              <Text className="text-[13px] font-semibold text-black/70 capitalize">
                                {(offer.min_ltv * 100).toFixed(2)}%
                              </Text>
                            </Flex>
                            <Separator size={"4"} className="bg-font/10" />
                            {/* Coin */}
                            <Flex justify={"between"} align={"center"}>
                              <Text as="label" size={"2"} weight={"medium"} className="text-font/70">
                                Coin
                              </Text>
                              <Text className="text-[13px] font-semibold text-black/70 capitalize">
                                {coinLabel}
                              </Text>
                            </Flex>
                          </Box>
                        </Box>
                      </Box>
                    </Box>

                    <Flex align={"center"} justify={"between"} px={"3"} className="pt-4">
                      {/* Update Information */}
                      <Flex align={"center"} gap={"2"}>
                        <Text
                          as="label"
                          size={{
                            initial: "1",
                            sm: "2",
                          }}
                          weight={"medium"}
                        >
                          Last Edited:
                        </Text>
                        <Text
                          as="p"
                          size={{
                            initial: "1",
                            sm: "2",
                          }}
                          weight={"medium"}
                        >
                          {new Date(offer.updated_at).toLocaleDateString()}
                        </Text>
                      </Flex>

                      {/* Delete Offer */}
                      {offer.status !== LoanOfferStatus.Deleted
                        && (
                          <Dialog.Root>
                            <Dialog.Trigger>
                              <Button size={"3"} color="tomato">
                                <Text as="span" size={"2"} weight={"medium"}>
                                  Retract Offer
                                </Text>
                              </Button>
                            </Dialog.Trigger>

                            <Dialog.Content maxWidth="450px">
                              <Dialog.Title>Retract Offer</Dialog.Title>
                              <Dialog.Description size="2" mb="4">
                                Please confirm the retraction of this offer.
                              </Dialog.Description>

                              {error
                                ? (
                                  <Callout.Root color="red" className="w-full">
                                    <Callout.Icon>
                                      <FontAwesomeIcon icon={faWarning} />
                                    </Callout.Icon>
                                    <Callout.Text>{error}</Callout.Text>
                                  </Callout.Root>
                                )
                                : (
                                  ""
                                )}

                              <Flex gap="3" mt="4" justify="end">
                                <Dialog.Close>
                                  <Button variant="soft" color="gray">
                                    Cancel
                                  </Button>
                                </Dialog.Close>
                                <Button
                                  loading={loading}
                                  disabled={loading}
                                  onClick={() => onDeleteOffer(offer.id)}
                                  size={"2"}
                                  color="tomato"
                                >
                                  <Text as="span" size={"2"} weight={"medium"}>
                                    Retract
                                  </Text>
                                </Button>
                              </Flex>
                            </Dialog.Content>
                          </Dialog.Root>
                        )}
                    </Flex>
                  </Box>
                </Box>
              </Grid>
            </Box>
          );
        }}
      />
    </Suspense>
  );
}

export default MyLoanOfferDetails;
