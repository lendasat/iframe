import { faWarning } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  LoanOfferStatus,
  useLenderHttpClient,
} from "@frontend-monorepo/http-client-lender";
import {
  formatCurrency,
  getFormatedStringFromDays,
  KycBadge,
  LoanAssetHelper,
} from "@frontend-monorepo/ui-shared";
import * as Checkbox from "@radix-ui/react-checkbox";
import { CheckIcon } from "@radix-ui/react-icons";
import {
  Box,
  Button,
  Callout,
  Dialog,
  Flex,
  Grid,
  Heading,
  Separator,
  Text,
  TextField,
} from "@radix-ui/themes";
import { useState } from "react";
import { Col, Row } from "react-bootstrap";
import { FaPenNib } from "react-icons/fa";
import { IoReceipt } from "react-icons/io5";
import { MdOutlineSwapCalls } from "react-icons/md";
import { useNavigate, useParams } from "react-router-dom";
import { useAsync } from "react-use";
import BannerImg from "./../../assets/banner.png";
import LendasatLogo from "./../../assets/lendasat.png";
import ReceipImg from "./../../assets/receipt_img.png";
import { StatusBadge } from "./status-badge";

function MyLoanOfferDetails() {
  const { getMyLoanOffer, deleteLoanOffer } = useLenderHttpClient();
  const { id } = useParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const layout = window;

  const { value: offer, error: loadingError } = useAsync(async () => {
    if (id) {
      return getMyLoanOffer(id);
    } else {
      return undefined;
    }
  }, [id]);

  if (loadingError || !offer) {
    return (
      <Box
        className="flex flex-col items-center justify-center gap-y-4 px-5 text-center"
        style={{
          height: layout.innerHeight - 130,
        }}
      >
        <Box className="rounded-full bg-white h-52 w-52 overflow-hidden flex items-center justify-center">
          <img src={ReceipImg} alt="error card" className="max-w-52" />
        </Box>
        <Text className="text-font/50 dark:text-font-dark/50" size={"2"}>
          An Error Occurred... ${JSON.stringify(loadingError) || ""}
        </Text>
      </Box>
    );
  }

  const onDeleteOffer = async (id: string) => {
    setLoading(true);
    try {
      await deleteLoanOffer(id);
      setIsOpen(false);
      navigate(0);
    } catch (error) {
      setError(`${error}`);
    } finally {
      setLoading(false);
    }
  };

  // Edit loan Information

  //  Should be replaced with the current offer values

  const loanAsset = offer.loan_asset;

  const coinLabel = LoanAssetHelper.print(loanAsset);

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
            <FaPenNib className="text-font dark:text-font-dark" />
            <Heading size={"5"} className="text-font dark:text-font-dark">
              Edit Loan
            </Heading>
          </Flex>

          <Box className="space-y-5">
            {/* Amount */}
            <Box className="space-y-1">
              <Text
                as="label"
                size={"2"}
                weight={"medium"}
                className="text-font/60 dark:text-font-dark/60"
              >
                Amount
              </Text>
              <Flex align={"center"} gap={"15px"}>
                <TextField.Root
                  size="3"
                  color="purple"
                  className="flex-1 text-sm rounded-lg"
                  type="text"
                  placeholder="Min Amount"
                  value={formatCurrency(offer.loan_amount_min)}
                  disabled={true}
                />

                <MdOutlineSwapCalls />

                <TextField.Root
                  size="3"
                  type="text"
                  className="flex-1 text-sm rounded-lg"
                  color="purple"
                  placeholder="Max Amount"
                  value={formatCurrency(offer.loan_amount_max)}
                  variant="surface"
                  disabled={true}
                />
              </Flex>
            </Box>

            {/* Reserve */}
            <Box className="space-y-1">
              <Text
                as="label"
                size={"2"}
                weight={"medium"}
                className="text-font/60 dark:text-font-dark/60"
              >
                Loan Amount Reserve
              </Text>
              <TextField.Root
                size="3"
                className="flex-1 text-sm rounded-lg"
                type="text"
                placeholder="Loan Reserve"
                color="purple"
                value={formatCurrency(offer.loan_amount_reserve)}
                min={0}
                max={1}
                step={0.01}
                disabled={true}
              >
                <TextField.Slot className="pr-0" />
                <TextField.Slot>
                  <Text size={"2"} weight={"medium"}>
                    ({formatCurrency(offer.loan_amount_reserve_remaining)}{" "}
                    remaining)
                  </Text>
                </TextField.Slot>
              </TextField.Root>
            </Box>

            {/* Auto Accept */}
            <Box className="space-y-1">
              <Flex
                align={"center"}
                gap={"2"}
                className="text-font dark:text-font-dark"
              >
                <Text
                  as="label"
                  size={"2"}
                  weight={"medium"}
                  className="text-font/60 dark:text-font-dark/60"
                >
                  Auto Accept within Reserve
                </Text>
              </Flex>

              <div className="flex items-center">
                <Checkbox.Root
                  className="flex size-[25px] appearance-none items-center justify-center rounded shadow-[0_2px_10px] shadow-blackA4 outline-none hover:bg-violet3 focus:shadow-[0_0_0_2px_black]"
                  checked={offer.auto_accept}
                  disabled={true}
                  id={"c1"}
                >
                  <Checkbox.Indicator className="text-violet11">
                    <CheckIcon />
                  </Checkbox.Indicator>
                </Checkbox.Root>
                <label
                  className="text-font/60 dark:text-font-dark/60"
                  htmlFor="c1"
                >
                  Auto accept requests within Loan Reserve
                </label>
              </div>
            </Box>

            {/* Duration */}
            <Box className="space-y-1">
              <Text
                as="label"
                size={"2"}
                weight={"medium"}
                className="text-font/60 dark:text-font-dark/60"
              >
                Duration
              </Text>
              <Text
                as="span"
                className="text-font/50 dark:text-font-dark/50"
                weight={"medium"}
                size={"1"}
              >
                (days)
              </Text>
              <Flex align={"center"} gap={"15px"}>
                <TextField.Root
                  size="3"
                  className="flex-1 text-sm rounded-lg"
                  type="number"
                  color="purple"
                  placeholder="Min Duration"
                  value={offer.duration_days_min}
                  disabled={true}
                />

                <MdOutlineSwapCalls />

                <TextField.Root
                  size="3"
                  type="number"
                  color="purple"
                  className="flex-1 text-sm rounded-lg"
                  placeholder="Max Duration"
                  value={offer.duration_days_max}
                  disabled={true}
                />
              </Flex>
            </Box>

            {/* Interest Rate */}
            <Box className="space-y-1">
              <Text
                as="label"
                size={"2"}
                weight={"medium"}
                className="text-font/60 dark:text-font-dark/60"
              >
                Interest Rate
              </Text>
              <TextField.Root
                size="3"
                className="flex-1 text-sm rounded-lg"
                type="number"
                placeholder="Interest Rate"
                color="purple"
                value={(offer.interest_rate * 100).toFixed(2)}
                min={0}
                max={1}
                step={0.01}
                disabled={true}
              >
                <TextField.Slot className="pr-0" />
                <TextField.Slot>
                  <Text size={"2"} weight={"medium"}>
                    1 - 100
                  </Text>
                </TextField.Slot>
              </TextField.Root>
            </Box>

            {/* LTV */}
            <Box className="space-y-1">
              <Text
                as="label"
                size={"2"}
                weight={"medium"}
                className="text-font/60 dark:text-font-dark/60"
              >
                Loan to Value (LTV)
              </Text>
              <TextField.Root
                size="3"
                className="flex-1 text-sm rounded-lg"
                type="number"
                placeholder="LTV (1-100)"
                color="purple"
                value={(offer.min_ltv * 100).toFixed(2)}
                min={1}
                max={100}
                step={0.5}
                disabled={true}
              >
                <TextField.Slot className="pr-0" />
                <TextField.Slot>
                  <Text size={"2"} weight={"medium"}>
                    1 - 100
                  </Text>
                </TextField.Slot>
              </TextField.Root>
            </Box>

            {offer.kyc_link && (
              <Box className="space-y-1">
                <Text
                  as="label"
                  size={"2"}
                  weight={"medium"}
                  className="text-font/60 dark:text-font-dark/60"
                >
                  KYC Link
                </Text>
                <TextField.Root
                  size="3"
                  className="flex-1 text-sm rounded-lg"
                  type="text"
                  color="purple"
                  value={offer.kyc_link}
                  disabled={true}
                ></TextField.Root>
              </Box>
            )}
          </Box>
        </Box>
        <Box className="p-5 xl:h-full flex flex-col items-center justify-center order-1 md:order-2">
          <Box className="bg-light dark:bg-dark flex-1 flex flex-col w-full rounded-2xl border border-font/10 dark:border-font-dark/10 p-2 xl:p-4">
            <Flex align={"center"} justify={"between"} className="pb-4 px-3">
              {/* Title */}
              <Flex align={"center"} gap={"2"}>
                <IoReceipt className="text-font dark:text-font-dark" />
                <Heading size={"5"} className="text-font dark:text-font-dark">
                  Loan Preview
                </Heading>
              </Flex>
            </Flex>

            <Box className="bg-gradient-to-tr from-60% to-100% from-[#FBFAF8] to-pink-700/5 dark:from-dark-600 dark:to-dark-700 p-6 rounded-2xl flex items-center justify-center flex-1">
              <Box className="space-y-6 min-w-[300px] w-full max-w-sm bg-white dark:bg-dark rounded-xl py-7">
                <Flex
                  align={"start"}
                  justify={"between"}
                  mb="8"
                  className="px-4 md:px-5"
                >
                  {/* Logo */}
                  <Box>
                    <img
                      src={LendasatLogo}
                      alt="Lendasat Logo"
                      className="h-4 w-auto shrink-0 dark:filter dark:invert dark:brightness-90"
                    />
                  </Box>

                  <Row>
                    <Col>
                      <StatusBadge offer={offer} />
                    </Col>
                    {offer.kyc_link && (
                      <Col>
                        <KycBadge />
                      </Col>
                    )}
                  </Row>
                </Flex>
                {/* Created date */}
                <Flex
                  align={"center"}
                  justify={"end"}
                  gap={"2"}
                  className="px-4 md:px-5"
                >
                  <Text
                    as="label"
                    size={"1"}
                    weight={"medium"}
                    className={"text-font dark:text-font-dark"}
                  >
                    Created on:
                  </Text>
                  <Text
                    as="p"
                    size={"1"}
                    weight={"medium"}
                    className={"text-font dark:text-font-dark"}
                  >
                    {new Date(offer.created_at).toLocaleDateString()}
                  </Text>
                </Flex>

                <Box className="px-3 md:px-5">
                  <Box className="mb-2 pl-3">
                    <Text className="text-font/80 dark:text-font-dark/80 font-medium">
                      Details
                    </Text>
                  </Box>
                  <Box className="border border-font/10 dark:border-font-dark/10 space-y-5 p-4 rounded-xl py-6">
                    {/* Amount */}
                    <Flex justify={"between"} align={"center"}>
                      <Text
                        as="label"
                        size={"2"}
                        weight={"medium"}
                        className="text-font/70 dark:text-font-dark/70"
                      >
                        Amount
                      </Text>
                      <Text className="text-[13px] font-semibold text-font/70 dark:text-font-dark/70 capitalize">
                        {formatCurrency(offer.loan_amount_min)} -{" "}
                        {formatCurrency(offer.loan_amount_max)}
                      </Text>
                    </Flex>
                    <Separator
                      size={"4"}
                      className="bg-font/10 dark:bg-font-dark/10"
                    />
                    {/* Duration */}
                    <Flex justify={"between"} align={"center"}>
                      <Text
                        as="label"
                        size={"2"}
                        weight={"medium"}
                        className="text-font/70 dark:text-font-dark/70"
                      >
                        Loan Duration
                      </Text>
                      <Text className="text-[13px] font-semibold text-font/70 dark:text-font-dark/70 capitalize">
                        {getFormatedStringFromDays(offer.duration_days_min)} -{" "}
                        {getFormatedStringFromDays(offer.duration_days_max)}
                      </Text>
                    </Flex>
                    <Separator
                      size={"4"}
                      className="bg-font/10 dark:bg-font-dark/10"
                    />
                    {/* Interest */}
                    <Flex justify={"between"} align={"center"}>
                      <Text
                        as="label"
                        size={"2"}
                        weight={"medium"}
                        className="text-font/70 dark:text-font-dark/70"
                      >
                        Interest Rate
                      </Text>
                      <Text className="text-[13px] font-semibold text-font/70 dark:text-font-dark/70 capitalize">
                        {(offer.interest_rate * 100).toFixed(2)}%
                      </Text>
                    </Flex>
                    <Separator
                      size={"4"}
                      className="bg-font/10 dark:bg-font-dark/10"
                    />
                    {/* Ltv */}
                    <Flex justify={"between"} align={"center"}>
                      <Text
                        as="label"
                        size={"2"}
                        weight={"medium"}
                        className="text-font/70 dark:text-font-dark/70"
                      >
                        LTV
                      </Text>
                      <Text className="text-[13px] font-semibold text-font/70 dark:text-font-dark/70 capitalize">
                        {(offer.min_ltv * 100).toFixed(2)}%
                      </Text>
                    </Flex>
                    <Separator
                      size={"4"}
                      className="bg-font/10 dark:bg-font-dark/10"
                    />
                    {/* Coin */}
                    <Flex justify={"between"} align={"center"}>
                      <Text
                        as="label"
                        size={"2"}
                        weight={"medium"}
                        className="text-font/70 dark:text-font-dark/70"
                      >
                        Coin
                      </Text>
                      <Text className="text-[13px] font-semibold text-font/70 dark:text-font-dark/70 capitalize">
                        {coinLabel}
                      </Text>
                    </Flex>
                  </Box>
                </Box>
              </Box>
            </Box>

            <Flex
              align={"center"}
              justify={"between"}
              px={"3"}
              className="pt-4"
            >
              {/* Update Information */}
              <Flex align={"center"} gap={"2"}>
                <Text
                  as="label"
                  size={{
                    initial: "1",
                    sm: "2",
                  }}
                  weight={"medium"}
                  className={"text-font dark:text-font-dark"}
                >
                  Last Edited:
                </Text>
                <Text
                  className={"text-font dark:text-font-dark"}
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
              {offer.status !== LoanOfferStatus.Deleted && (
                <Dialog.Root open={isOpen}>
                  <Dialog.Trigger>
                    <Button
                      size={"3"}
                      color="tomato"
                      onClick={() => setIsOpen(true)}
                    >
                      <Text as="span" size={"2"} weight={"medium"}>
                        Retract Offer
                      </Text>
                    </Button>
                  </Dialog.Trigger>

                  <Dialog.Content
                    maxWidth="450px"
                    className={"bg-light dark:bg-dark"}
                  >
                    <Dialog.Title className={"text-font dark:text-font-dark"}>
                      Retract Offer
                    </Dialog.Title>
                    <Dialog.Description
                      className={"text-font dark:text-font-dark"}
                      size="2"
                      mb="4"
                    >
                      Please confirm the retraction of this offer.
                    </Dialog.Description>

                    {error ? (
                      <Callout.Root color="red" className="w-full">
                        <Callout.Icon>
                          <FontAwesomeIcon icon={faWarning} />
                        </Callout.Icon>
                        <Callout.Text>{error}</Callout.Text>
                      </Callout.Root>
                    ) : (
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
}

export default MyLoanOfferDetails;
