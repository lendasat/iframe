import { useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import { CurrencyFormatter } from "@frontend-monorepo/ui-shared";
import { Box, Button, Flex, Grid, Heading, Skeleton, Spinner, Text } from "@radix-ui/themes";
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

export default function Cards() {
  const { innerHeight } = window;
  const [visible, setVisible] = useState<boolean>(false);
  const [activeCardIndex, setActiveCardIndex] = useState<number>(0);

  const { getUserCards } = useBorrowerHttpClient();

  const { loading, value: maybeUserCardDetails, error } = useAsync(async () => {
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
      className="md:grid-cols-[minmax(390px,390px)_2fr] overflow-y-scroll"
      style={{
        height: innerHeight - 100,
      }}
    >
      <Box
        className={` p-4 ${
          activeCard ? " " : "hidden md:block"
        } md:px-8 space-y-4 border-r border-font/10 bg-white h-full`}
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
            {userCardDetails.map((card, index) => (
              <SwiperSlide key={index}>
                <CreditCard
                  card={card}
                  visible={visible}
                  setVisible={(vis) => setVisible(vis)}
                />
              </SwiperSlide>
            ))}
          </Swiper>
        </Skeleton>

        <Box className="pt-5 space-y-4">
          <Grid className="grid-cols-2 gap-2">
            <Skeleton loading={!activeCard} className="flex items-center justify-between">
              <Box className="min-h-[150px] w-full border border-font/10 flex flex-col items-center justify-center gap-1.5 text-font rounded-2xl">
                <Box className={`h-12 w-12 bg-purple-50 rounded-xl place-items-center flex justify-center`}>
                  <IoWallet size={"24"} />
                </Box>
                <Text size={"1"} weight={"medium"}>Available Balance</Text>
                <Heading size={"2"}>
                  <Skeleton loading={!activeCard}>
                    {activeCard && <CurrencyFormatter value={activeCard.available_balance} />}
                  </Skeleton>
                </Heading>
              </Box>
            </Skeleton>

            <Skeleton loading={!activeCard} className="flex items-center justify-between">
              <Box className="min-h-[150px] w-full border border-font/10 flex flex-col items-center justify-center gap-1.5 text-font rounded-2xl">
                <Box className={`h-12 w-12 bg-purple-50 rounded-xl place-items-center flex justify-center`}>
                  <IoWallet size={"24"} />
                </Box>
                <Text size={"1"} weight={"medium"}>Balance</Text>
                <Heading size={"2"}>
                  <Skeleton loading={!activeCard}>
                    {activeCard && <CurrencyFormatter value={activeCard.balance} />}
                  </Skeleton>
                </Heading>
              </Box>
            </Skeleton>
          </Grid>

          <Box className="space-y-1">
            <Skeleton loading={!activeCard}>
              <Flex align={"center"} justify={"between"}>
                <Heading as="h4" size={"3"} weight={"medium"}>
                  Card Details
                </Heading>
                <Button
                  onClick={() => setVisible(!visible)}
                  disabled={!activeCard}
                  variant="ghost"
                  className="hover:bg-transparent text-xs font-medium text-purple-800"
                >
                  {!visible ? " Show" : "Hide"}
                  {"   "}
                </Button>
              </Flex>
            </Skeleton>

            <Skeleton loading={!activeCard}>
              <Text size={"1"} weight={"medium"} className="text-font/60">Card Number</Text>
              <Text as="p" weight={"medium"}>
                <Skeleton loading={!activeCard}>
                  {visible ? formatCreditCardNumber(activeCard.pan) : "******"}
                </Skeleton>
              </Text>
            </Skeleton>
            <Skeleton loading={!activeCard}>
              <Flex justify={"between"}>
                <Box>
                  <Text size={"1"} weight={"medium"} className="text-font/60">Expiry</Text>
                  <Text as="p" weight={"medium"}>
                    <Skeleton loading={!activeCard}>
                      {visible ? activeCard.expiration : "****"}
                    </Skeleton>
                  </Text>
                </Box>
                <Box>
                  <Text size={"1"} weight={"medium"} className="text-font/60">CVV</Text>
                  <Text as="p" weight={"medium"}>
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
      <Box className={`flex flex-col ${!activeCard ? "items-center justify-center" : ""} gap-4 py-4`}>
        {activeCard
          && (
            <Box className="px-6 md:px-8">
              <Heading>
                Transactions
              </Heading>
            </Box>
          )}

        {/*TODO: show some information if no card is available yet*/}
        {!activeCard
          ? (
            <Box className="text-center">
              <Text as="p" weight={"medium"}>
                Why no credit card yet?!
              </Text>
              <img src={NoCreditCard} alt="Credit Card" className="h-40 w-auto mb-3" />
              <Link to={"/requests"} className="text-font/70 hover:text-purple-800">
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
          )
          : (
            <CardHistory
              cardId={activeCard.id}
              lastFourCardDigits={activeCard.pan.toString().substring(activeCard.pan.toString().length - 4)}
            />
          )}
      </Box>
    </Grid>
  );
}

// Format Card Number
export const formatCreditCardNumber = (number: number) => {
  const numStr = number.toString().replace(/\D/g, "");
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
