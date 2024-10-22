import { useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import { Box, Button, Flex, Grid, Heading, Skeleton, Spinner, Text } from "@radix-ui/themes";
import React from "react";
import { GoArrowUpRight } from "react-icons/go";
import { IoWallet } from "react-icons/io5";
import { Link } from "react-router-dom";
import { useAsync } from "react-use";
import { EffectCards } from "swiper/modules";
import { Swiper as SwiperComponent, SwiperRef, SwiperSlide } from "swiper/react";
import CardHistory from "./CardHistory";
import CreditCards from "./CreditCards";

export default function Cards() {
  const { innerHeight } = window;
  const [moreInfo, setMoreInfo] = React.useState<boolean>(false);
  const [activeCardIndex, setActiveCardIndex] = React.useState<number>(0);
  // Change Card
  const SlideRef = React.useRef<SwiperRef>(null);

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

  const onSwitchCard = () => {
    SlideRef.current?.swiper.slideNext();
    if (activeCardIndex !== userCardDetails.length - 1) {
      setActiveCardIndex(activeCardIndex + 1);
    } else {
      setActiveCardIndex(0);
    }
  };

  const activeCard = userCardDetails[activeCardIndex];
  return (
    <Grid
      className="md:grid-cols-[minmax(350px,_1fr)_2fr] overflow-y-scroll"
      style={{
        height: innerHeight - 100,
      }}
    >
      <Box className="border-r border-font/10 bg-white p-4 md:px-8 h-full space-y-4">
        <Flex align={"center"} justify={"between"}>
          <Heading size={"5"} weight={"medium"}>
            My Cards
          </Heading>
          {userCardDetails.length > 1 && (
            <Button
              variant="ghost"
              onClick={onSwitchCard}
              className="hover:bg-transparent font-medium text-font/60 hover:text-font"
            >
              Switch Card
            </Button>
          )}
        </Flex>

        <SwiperComponent
          loop
          ref={SlideRef}
          effect={"cards"}
          grabCursor={false}
          allowTouchMove={false}
          modules={[EffectCards]}
          centeredSlides
          cardsEffect={{
            perSlideOffset: 7,
            slideShadows: false,
          }}
          className="h-52 w-full"
        >
          {userCardDetails.map((card, index) => (
            <SwiperSlide key={index}>
              <CreditCards
                cardNumber={card.cardNumber}
                visibility={moreInfo}
              />
            </SwiperSlide>
          ))}
        </SwiperComponent>
        <Box>
          <Flex align={"center"}>
            <Button variant="soft" size={"3"} color="purple" className="text-sm flex-grow rounded-lg">
              Add New Card
            </Button>
          </Flex>
        </Box>
        <Box className="pt-5 space-y-4">
          <Heading as="h4" size={"3"} weight={"medium"}>
            My Details
          </Heading>

          <Grid className="grid-cols-2 gap-2">
            <Box className="flex items-center justify-between">
              <Box className="min-h-[150px] w-full border border-font/10 flex flex-col items-center justify-center gap-1.5 text-font rounded-2xl">
                <Box className={`h-12 w-12 bg-purple-50 rounded-xl place-items-center flex justify-center`}>
                  <IoWallet size={"24"} />
                </Box>
                <Text size={"1"} weight={"medium"}>Balance</Text>
                <Heading size={"2"}>
                  <Skeleton loading={!activeCard}>
                    {/*<CurrencyFormatter value={activeCard.balance} />*/}
                  </Skeleton>
                </Heading>
              </Box>
            </Box>

            <Box className="flex items-center justify-between">
              <Box className="min-h-[150px] w-full border border-font/10 flex flex-col items-center justify-center gap-1.5 text-font rounded-2xl">
                <Box className={`h-12 w-12 bg-purple-50 rounded-xl place-items-center flex justify-center`}>
                  <GoArrowUpRight size={"24"} />
                </Box>
                <Text size={"1"} weight={"medium"}>Outgoing</Text>
                <Heading size={"2"}>
                  <Skeleton loading={!activeCard}>
                    {/*<CurrencyFormatter value={activeCard.outgoing} />*/}
                  </Skeleton>
                </Heading>
              </Box>
            </Box>
          </Grid>

          <Box className="space-y-1">
            <Flex align={"center"} justify={"between"}>
              <Heading as="h4" size={"3"} weight={"medium"}>
                More Info
              </Heading>
              <Button
                onClick={() => setMoreInfo(!moreInfo)}
                disabled={!activeCard}
                variant="ghost"
                className="hover:bg-transparent text-xs font-medium text-purple-800"
              >
                {!moreInfo ? " View" : "Hide"}{"   "}Details
              </Button>
            </Flex>
            <Box>
              <Text size={"1"} weight={"medium"} className="text-font/60">Card Number</Text>
              <Text as="p" weight={"medium"}>
                <Skeleton loading={!activeCard}>
                  {moreInfo ? formatCreditCardNumber(activeCard.cardNumber) : "******"}
                </Skeleton>
              </Text>
            </Box>
            <Flex justify={"between"}>
              <Box>
                <Text size={"1"} weight={"medium"} className="text-font/60">Expiry</Text>
                <Text as="p" weight={"medium"}>
                  <Skeleton loading={!activeCard}>
                    {moreInfo ? formatDate(activeCard.expiry) : "****"}
                  </Skeleton>
                </Text>
              </Box>
              <Box>
                <Text size={"1"} weight={"medium"} className="text-font/60">CVV</Text>
                <Text as="p" weight={"medium"}>
                  <Skeleton loading={!activeCard}>
                    {moreInfo ? activeCard.cardCvv : "****"}
                  </Skeleton>
                </Text>
              </Box>
            </Flex>
          </Box>
        </Box>
        <Box>
          <Flex align={"center"} gap={"2"}>
            <Button asChild variant="outline" size={"4"} color="purple" className="text-sm flex-grow rounded-lg">
              <Link to={"/requests"}>
                Add Funds
              </Link>
            </Button>
          </Flex>
        </Box>
      </Box>
      <Box className="flex flex-col gap-4 py-4">
        <Box className="px-6 md:px-8">
          <Heading>
            Transactions
          </Heading>
        </Box>
        {/*TODO: show some information if no card is available yet*/}
        {!activeCard ? "" : <CardHistory cardId={activeCard.id} />}
      </Box>
    </Grid>
  );
}

// Format Card Number
export const formatCreditCardNumber = (number: number) => {
  const numStr = number.toString().replace(/\D/g, "");
  return numStr.replace(/(\d{4})(?=\d)/g, "$1 ");
};

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
  });
};
