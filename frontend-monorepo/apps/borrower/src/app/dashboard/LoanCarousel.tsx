import type { Contract } from "@frontend-monorepo/http-client-borrower";
import { ContractStatus, useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import type { SwiperRef } from "swiper/react";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
import { CurrencyFormatter } from "@frontend-monorepo/ui-shared";
import { Box, Flex, Heading, IconButton, Text } from "@radix-ui/themes";
import React, { Suspense } from "react";
import { FaExternalLinkAlt } from "react-icons/fa";
import { FaArrowLeftLong, FaArrowRightLong } from "react-icons/fa6";
import { Await } from "react-router-dom";
import CreditCard from "../../assets/credit-card.png";
import { StatusBadge } from "../components/status-badge";

interface UCardProp {
  loans: Contract[];
}

export default function LoanCarousel() {
  const { getContracts } = useBorrowerHttpClient();

  // Back and Front swipe movement
  const SlideRef = React.useRef<SwiperRef | undefined>();

  const handleNext = () => {
    SlideRef.current?.swiper.slideNext();
  };

  const handlePrev = () => {
    SlideRef.current?.swiper.slidePrev();
  };

  const UCard = (props: UCardProp) => {
    const { loans } = props;

    if (loans.length === 0) {
      return (
        <Box className="h-60 flex flex-col items-center justify-center">
          <img src={CreditCard} alt="credit card" className="max-w-40" />
          <Text className="text-font/50" size={"1"}>You currently don't have any loan</Text>
        </Box>
      );
    }

    const urlPrefix = import.meta.env.VITE_MEMPOOL_REST_URL;

    return (
      <Box className="space-y-4">
        <Flex align={"center"} justify={"between"} pr={"3"}>
          <Text as="p" weight={"medium"} className="text-font" size={"3"}>My Loans</Text>
          <Flex align={"center"} gap={"4"}>
            <IconButton
              onClick={handlePrev}
              variant="ghost"
              className="hover:bg-transparent text-font/80 text-lg"
            >
              <FaArrowLeftLong />
            </IconButton>
            <IconButton
              onClick={handleNext}
              variant="ghost"
              className="hover:bg-transparent text-font/80 text-lg"
            >
              <FaArrowRightLong />
            </IconButton>
          </Flex>
        </Flex>
        <Swiper
          spaceBetween={10}
          ref={SlideRef}
          loop
        >
          {loans.map((loan, index) => {
            const { lender, expiry, loan_amount, contract_address, status } = loan;
            const displayedAddress = contract_address || "Your vault address will be shown here once funded";
            const isAddressPresent = !!contract_address;

            return (
              <SwiperSlide
                key={index}
                className={`border h-52 xl:h-60 border-font/[5%] rounded-2xl ${
                  (index + 1) % 2 === 0 ? "bg-purple-50" : "bg-green-50"
                } pt-3 pb-5 px-4 flex flex-col justify-between`}
              >
                <Box>
                  <Text weight={"regular"} size={"1"} className="text-font/60">Loan Amount</Text>
                  {/* Loan Amount */}
                  <Flex justify="between" align="center" width="100%">
                    <Heading size={"7"} mt={"1"}>
                      <CurrencyFormatter value={loan_amount} />
                    </Heading>
                    {<StatusBadge status={status} />}
                  </Flex>
                </Box>
                <Box>
                  <Flex align={"end"} justify={"between"}>
                    <Box className="flex flex-col items-left gap-y-1">
                      <div className="flex items-center w-full">
                        <Text size={"1"} className="text-font/90 italic mr-2 truncate">{displayedAddress}</Text>
                        <div className="flex-grow" />
                        {isAddressPresent && (
                          <a
                            href={`${urlPrefix}/address/${displayedAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0"
                          >
                            <FaExternalLinkAlt className="text-font/90" />
                          </a>
                        )}
                      </div>
                      {/* Lenders Name */}
                      <Text size="3" className="tracking-wider text-font/90 capitalize">{lender.name}</Text>
                    </Box>
                    <Box className="flex flex-col items-end gap-y-1">
                      <Text size="1" className="tracking-wider text-font/90">Due on</Text>
                      {/* Due Date */}
                      <Text size="1" weight={"medium"} className="tracking-wider text-font-dark">
                        {expiry.toLocaleDateString()}
                      </Text>
                    </Box>
                  </Flex>
                </Box>
              </SwiperSlide>
            );
          })}
        </Swiper>
      </Box>
    );
  };

  return (
    <Box>
      <Suspense>
        <Await
          resolve={getContracts()}
          errorElement={
            <Box className="h-60 flex flex-col items-center justify-center">
              <img src={CreditCard} alt="credit card" className="max-w-40" />
              <Text className="text-font/50" size={"1"}>System overload, please refresh</Text>
            </Box>
          }
          children={(contracts: Awaited<Contract[]>) => (
            <UCard
              loans={contracts.filter((
                loan,
              ) => (loan.status !== ContractStatus.Closed && loan.status !== ContractStatus.Rejected))}
            />
          )}
        />
      </Suspense>
    </Box>
  );
}
