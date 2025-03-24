// Types
import { LoanProductOption } from "@frontend/base-http-client";
import { Box, Flex, Heading, ScrollArea, Text } from "@radix-ui/themes";
import { ColumnFiltersState } from "@tanstack/react-table";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Confirmation } from "./confirmation";
import { LoanAmountAndDurationInputs } from "./loan-amount-and-duration-inputs";
import { OffersSelectionTable } from "./offer-selection/offers-selection";

export const LoanRequestFlow = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  // Initialize state from URL parameters
  const [selectedProduct, setSelectedProduct] = useState<
    LoanProductOption | undefined
  >(
    (searchParams.get("product") as LoanProductOption) ||
      LoanProductOption.StableCoins,
  );

  const [selectedOfferId, setSelectedOfferId] = useState<string | undefined>(
    (searchParams.get("offer") as string) || undefined,
  );

  const [selectedLoanAmount, setSelectedLoanAmount] = useState<
    string | undefined
  >((searchParams.get("amount") as string) || "1000");
  const [selectedLoanDuration, setSelectedLoanDuration] = useState<
    string | undefined
  >((searchParams.get("duration") as string) || "7");

  // Add refs for each section
  const offerSelectionRef = useRef<HTMLDivElement>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const scrollToElement = (ref: React.RefObject<HTMLDivElement>) => {
    if (!ref.current || !scrollAreaRef.current) return;

    const scrollArea = scrollAreaRef.current;
    const element = ref.current;

    // Get the element's position relative to the scroll area
    const elementTop = element.offsetTop;
    const scrollAreaTop = scrollArea.getBoundingClientRect().top;
    const relativeTop = elementTop - scrollAreaTop;

    // Scroll the ScrollArea viewport
    scrollArea?.scrollTo({
      top: relativeTop,
      behavior: "smooth",
    });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: conflicting rules for scrollToElement
  useEffect(() => {
    const service = searchParams.get("product") as LoanProductOption;
    const offer = searchParams.get("offer");

    if (service && service !== selectedProduct) {
      setSelectedProduct(service);
      // Scroll to middle section if we have a service in URL
      setTimeout(() => {
        scrollToElement(offerSelectionRef);
      }, 100);
    }

    if (offer && offer !== selectedOfferId) {
      setSelectedOfferId(offer);
      // Scroll to bottom section if we have both service and offer
      setTimeout(() => {
        scrollToElement(confirmationRef);
      }, 100);
    }
  }, [searchParams, selectedOfferId, selectedProduct]);

  const handleProductOptionSelect = (
    productOption: LoanProductOption | undefined,
  ) => {
    setSelectedProduct(productOption);
    handleOfferSelect(undefined);
    // Update URL
    if (productOption) {
      setSearchParams((params) => {
        params.set("product", productOption.toString());
        return params;
      });
    }
    setTimeout(() => {
      scrollToElement(offerSelectionRef);
    }, 100);
  };

  const handleOfferSelect = (offerId?: string) => {
    setSelectedOfferId(offerId);
    // Update URL preserving the service parameter
    if (offerId && offerId !== "undefined") {
      setSearchParams((prev) => {
        prev.set("offer", offerId);
        return prev;
      });
    } else {
      setSearchParams((prev) => {
        prev.delete("offer");
        return prev;
      });
    }

    setTimeout(() => {
      scrollToElement(confirmationRef);
    }, 100);
  };

  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const onSetLoanAmount = (newLoanAmount: string) => {
    setColumnFilters((prev) => {
      const existing = prev.filter((f) => f.id !== "amount");
      return newLoanAmount
        ? [...existing, { id: "amount", value: newLoanAmount }]
        : existing;
    });

    setSelectedLoanAmount(newLoanAmount);
    setSearchParams((params) => {
      params.set("amount", newLoanAmount);
      return params;
    });
  };

  const onSetLoanDuration = (days: number) => {
    setSelectedLoanDuration(days.toString());
    setColumnFilters((prev) => {
      const existing = prev.filter((f) => f.id !== "duration");
      const value = days.toString();
      return value ? [...existing, { id: "duration", value: value }] : existing;
    });

    setSearchParams((params) => {
      params.set("duration", days.toString());
      return params;
    });
  };
  return (
    <ScrollArea
      className="h-screen"
      type="always"
      scrollbars="vertical"
      ref={scrollAreaRef}
    >
      <Box className="container mx-auto py-8">
        <Box mx="auto" className="text-center">
          <Heading
            size="7"
            className="text-font dark:text-font-dark font-semibold"
          >
            Find a loan offer
          </Heading>
        </Box>

        <Box className="flex justify-center" mt={"6"} px={"6"}>
          {/* Use max-w-md to set a consistent maximum width for the form */}
          <LoanAmountAndDurationInputs
            setLoanAmount={onSetLoanAmount}
            loanAmount={selectedLoanAmount}
            selectedLoanDuration={selectedLoanDuration}
            onLoanDurationChange={onSetLoanDuration}
            onLoanProductSelect={handleProductOptionSelect}
            selectedOption={selectedProduct}
          />
        </Box>

        <Box ref={offerSelectionRef} mt={"6"} px={"6"}>
          <OffersSelectionTable
            selectedProduct={selectedProduct}
            onOfferSelect={handleOfferSelect}
            selectedOfferId={selectedOfferId}
            columnFilters={columnFilters}
            setColumnFilters={setColumnFilters}
          />
        </Box>

        <Box ref={confirmationRef} className={"mb-20"} mt={"6"} px={"6"}>
          <Confirmation
            selectedProduct={selectedProduct}
            selectedOfferId={selectedOfferId}
            selectedLoanAmount={selectedLoanAmount}
            selectedLoanDuration={selectedLoanDuration}
          />
          <Flex direction={"column"} mx={"2"} gap={"1"}>
            <Text size={"1"} weight={"light"}>
              During the closed beta we will be using a 2-of-3 multisig contract
              instead of a DLC. The keys are distributed among the borrower, the
              lender and Lendasat.
            </Text>
          </Flex>
        </Box>
      </Box>
    </ScrollArea>
  );
};
