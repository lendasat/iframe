import { useHttpClientBorrower } from "@frontend/http-client-borrower";
import { CurrencyFormatter } from "@frontend/ui-shared";
import {
  Box,
  Button,
  Flex,
  Grid,
  Heading,
  Skeleton,
  Spinner,
  Text,
} from "@radix-ui/themes";
import { useState } from "react";
import { IoWallet } from "react-icons/io5";
import { Link } from "react-router-dom";
import { useAsync } from "react-use";
import { Navigation } from "swiper/modules";
import { EffectCards } from "swiper/modules";
import { Swiper } from "swiper/react";
import { SwiperSlide } from "swiper/react";
import NoCreditCard from "./../../assets/creditcard-illustration.png";
import CardHistory from "./CardHistory";
import CreditCard from "./CreditCard";
import "swiper/scss";
import "swiper/scss/navigation";
import "swiper/scss/pagination";

export default function Cards() {
  const { innerHeight } = window;
  const [visible, setVisible] = useState<boolean>(false);
  const [activeCardIndex, setActiveCardIndex] = useState<number>(0);

  const { getUserCards } = useHttpClientBorrower();

  const {
    loading,
    value: maybeUserCardDetails,
    error,
  } = useAsync(async () => {
    return getUserCards();
  }, []);

  if (error) {
    console.error(`Failed loading card details ${error}`);
  }

  if (loading) {
    // TODO: return something nicer
    return (
      <Box
        className="flex items-center justify-center"
        style={{
          height: innerHeight - 100,
        }}
      >
        <Spinner size={"3"} />
      </Box>
    );
  }

  const userCardDetails = maybeUserCardDetails || [];

  const activeCard = userCardDetails[activeCardIndex];

  return (
    <Grid
      className="overflow-y-scroll md:grid-cols-[minmax(390px,390px)_2fr]"
      style={{
        height: innerHeight - 100,
      }}
    >
      <Box
        className={`p-4 ${
          activeCard ? " " : "hidden md:block"
        } border-font/10 bg-light dark:bg-dark-700 h-full space-y-4 border-r md:px-8`}
      >
        <Skeleton loading={!activeCard}>
          <Swiper
            effect={"cards"}
            grabCursor={true}
            modules={[EffectCards, Navigation]}
            onSlideChange={(s) => {
              setActiveCardIndex(s.activeIndex);
            }}
            className="h-52 w-full"
            navigation={true}
            cardsEffect={{
              perSlideOffset: 7,
              slideShadows: false,
            }}
          >
            {userCardDetails.map((card) => (
              <SwiperSlide key={card.id}>
                <CreditCard
                  card={card}
                  visible={visible}
                  setVisible={(vis) => setVisible(vis)}
                />
              </SwiperSlide>
            ))}
          </Swiper>
        </Skeleton>

        <Box className="space-y-4 pt-5">
          <Grid className="grid-cols-2 gap-2">
            <Skeleton
              loading={!activeCard}
              className="flex items-center justify-between"
            >
              <Box className="border-font/10 text-font dark:border-dark dark:bg-dark-600 flex min-h-[150px] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border">
                <Box
                  className={`flex h-12 w-12 place-items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-800/20`}
                >
                  <IoWallet size={"24"} />
                </Box>
                <Text
                  className={"text-font dark:text-font-dark"}
                  size={"1"}
                  weight={"medium"}
                >
                  Available Balance
                </Text>
                <Heading className={"text-font dark:text-font-dark"} size={"2"}>
                  <Skeleton loading={!activeCard}>
                    {activeCard && (
                      <CurrencyFormatter value={activeCard.available_balance} />
                    )}
                  </Skeleton>
                </Heading>
              </Box>
            </Skeleton>

            <Skeleton
              loading={!activeCard}
              className="flex items-center justify-between"
            >
              <Box className="border-font/10 text-font dark:border-dark dark:bg-dark-600 flex min-h-[150px] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border">
                <Box
                  className={`flex h-12 w-12 place-items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-800/20`}
                >
                  <IoWallet size={"24"} />
                </Box>
                <Text
                  className={"text-font dark:text-font-dark"}
                  size={"1"}
                  weight={"medium"}
                >
                  Balance
                </Text>
                <Heading className={"text-font dark:text-font-dark"} size={"2"}>
                  <Skeleton loading={!activeCard}>
                    {activeCard && (
                      <CurrencyFormatter value={activeCard.balance} />
                    )}
                  </Skeleton>
                </Heading>
              </Box>
            </Skeleton>
          </Grid>

          <Box className="space-y-1">
            <Skeleton loading={!activeCard}>
              <Flex align={"center"} justify={"between"}>
                <Heading
                  className={"text-font dark:text-font-dark"}
                  as="h4"
                  size={"3"}
                  weight={"medium"}
                >
                  Card Details
                </Heading>
                <Button
                  onClick={() => setVisible(!visible)}
                  disabled={!activeCard}
                  variant="ghost"
                  className="text-xs font-medium text-purple-800 hover:bg-transparent dark:text-purple-300"
                >
                  {!visible ? " Show" : "Hide"}
                  {"   "}
                </Button>
              </Flex>
            </Skeleton>

            <Skeleton loading={!activeCard}>
              <Text
                size={"1"}
                weight={"medium"}
                className="text-font/60 dark:text-font-dark/60"
              >
                Card Number
              </Text>
              <Text
                className={"text-font dark:text-font-dark"}
                as="p"
                weight={"medium"}
              >
                <Skeleton loading={!activeCard}>
                  {visible ? formatCreditCardNumber(activeCard.pan) : "******"}
                </Skeleton>
              </Text>
            </Skeleton>
            <Skeleton loading={!activeCard}>
              <Flex justify={"between"}>
                <Box>
                  <Text
                    size={"1"}
                    weight={"medium"}
                    className="text-font/60 dark:text-font-dark/60"
                  >
                    Expiry
                  </Text>
                  <Text
                    className={"text-font dark:text-font-dark"}
                    as="p"
                    weight={"medium"}
                  >
                    <Skeleton loading={!activeCard}>
                      {visible ? activeCard.expiration : "****"}
                    </Skeleton>
                  </Text>
                </Box>
                <Box>
                  <Text
                    size={"1"}
                    weight={"medium"}
                    className="text-font/60 dark:text-font-dark/60"
                  >
                    CVV
                  </Text>
                  <Text
                    className={"text-font dark:text-font-dark"}
                    as="p"
                    weight={"medium"}
                  >
                    <Skeleton loading={!activeCard}>
                      {visible ? activeCard.cvv : "****"}
                    </Skeleton>
                  </Text>
                </Box>
              </Flex>
            </Skeleton>
          </Box>
        </Box>
        {/*TODO: adding additional funds is currently not supported */}
        {/*<Skeleton loading={!activeCard}>*/}
        {/*  <Flex align={"center"} gap={"2"}>*/}
        {/*    <Button asChild variant="outline" size={"4"}*/}
        {/*            disabled={true}*/}
        {/*            color="purple" className="text-sm flex-grow rounded-lg">*/}
        {/*      <Link to={"/requests"}>*/}
        {/*        Add Funds*/}
        {/*      </Link>*/}
        {/*    </Button>*/}
        {/*  </Flex>*/}
        {/*</Skeleton>*/}
      </Box>
      <Box
        className={`flex flex-col ${
          !activeCard ? "items-center justify-center" : ""
        } gap-4 py-4`}
      >
        {activeCard && (
          <Box className="px-6 md:px-8">
            <Heading className={"text-font dark:text-font-dark"}>
              Transactions
            </Heading>
          </Box>
        )}

        {/*TODO: show some information if no card is available yet*/}
        {!activeCard ? (
          <Box className="text-center">
            <Text
              as="p"
              className={"text-font dark:text-font-dark"}
              weight={"medium"}
            >
              Why no credit card yet?!
            </Text>
            <img
              src={NoCreditCard}
              alt="Credit Card"
              className="mb-3 h-40 w-auto"
            />
            <Link
              to={"/requests"}
              className="text-font/70 hover:text-purple-800"
            >
              <Button
                variant="soft"
                size={"3"}
                color="purple"
                className="w-full"
              >
                Get a Card
              </Button>
            </Link>
          </Box>
        ) : (
          <CardHistory
            cardId={activeCard.id}
            lastFourCardDigits={activeCard.pan.substring(
              activeCard.pan.length - 4,
            )}
          />
        )}
      </Box>
    </Grid>
  );
}

// Format Card Number
export const formatCreditCardNumber = (pan: string) => {
  const numStr = pan.replace(/\D/g, "");
  return numStr.replace(/(\d{4})(?=\d)/g, "$1 ");
};

export const formatExpiryTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return formatExpiryDate(date);
};

export const formatExpiryDate = (date: Date): string => {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
  });
};
