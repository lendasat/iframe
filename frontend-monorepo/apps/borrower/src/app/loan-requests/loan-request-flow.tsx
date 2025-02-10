// Types
import { LoanProductOption } from "@frontend-monorepo/base-http-client";
import { Box, ScrollArea } from "@radix-ui/themes";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Confirmation } from "./confirmation";
import { OffersSelectionTable } from "./offers-selection";
import { ProductSelection } from "./product-options";

export const LoanRequestFlow = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  // Initialize state from URL parameters
  const [selectedProduct, setSelectedProduct] = useState<LoanProductOption | undefined>(
    searchParams.get("product") as LoanProductOption || undefined,
  );

  const [selectedOfferId, setSelectedOfferId] = useState<string | undefined>(
    searchParams.get("offer") as string || undefined,
  );

  const [selectedLoanAmount, setSelectedLoanAmount] = useState<string | undefined>(
    searchParams.get("amount") as string || undefined,
  );
  const [selectedLoanDuration, setSelectedLoanDuration] = useState<string | undefined>(
    searchParams.get("duration") as string || undefined,
  );

  // Add refs for each section
  const middleRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const scrollToElement = (ref: React.RefObject<HTMLDivElement>) => {
    if (!ref.current || !scrollAreaRef.current) return;

    const scrollArea = scrollAreaRef.current;
    const element = ref.current;

    // Get the element's position relative to the scroll area
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

  useEffect(() => {
    const service = searchParams.get("product") as LoanProductOption;
    const offer = searchParams.get("offer");

    if (service && service !== selectedProduct) {
      setSelectedProduct(service);
      // Scroll to middle section if we have a service in URL
      setTimeout(() => {
        scrollToElement(middleRef);
      }, 100);
    }

    if (offer && offer !== selectedOfferId) {
      setSelectedOfferId(offer);
      // Scroll to bottom section if we have both service and offer
      setTimeout(() => {
        scrollToElement(bottomRef);
      }, 100);
    }
  }, [searchParams, selectedOfferId]);

  const handleProductOptionSelect = (productOption: LoanProductOption | undefined) => {
    setSelectedProduct(productOption);
    setSelectedOfferId(undefined);
    // Update URL
    if (productOption) {
      setSearchParams(params => {
        params.set("product", productOption.toString());
        return params;
      });
    }
    setTimeout(() => {
      scrollToElement(middleRef);
    }, 100);
  };

  const handleOfferSelect = (offerId?: string) => {
    setSelectedOfferId(offerId);
    // Update URL preserving the service parameter
    if (offerId && offerId !== "undefined") {
      setSearchParams(prev => {
        prev.set("offer", offerId);
        return prev;
      });
    } else {
      setSearchParams(prev => {
        prev.delete("offer");
        return prev;
      });
    }

    setTimeout(() => {
      scrollToElement(bottomRef);
    }, 100);
  };

  return (
    <ScrollArea className="h-screen" type="always" scrollbars="vertical" ref={scrollAreaRef}>
      <Box className="container mx-auto py-8">
        <ProductSelection
          onSelect={(option) => {
            handleProductOptionSelect(option);
          }}
          selectedOption={selectedProduct}
        />

        <div ref={middleRef}>
          <OffersSelectionTable
            selectedProduct={selectedProduct}
            onOfferSelect={handleOfferSelect}
            selectedOfferId={selectedOfferId}
            selectedLoanAmount={selectedLoanAmount}
            setLoanAmount={setSelectedLoanAmount}
            selectedLoanDuration={selectedLoanDuration}
            setLoanDuration={setSelectedLoanDuration}
          />
        </div>

        <div ref={bottomRef}>
          <Confirmation
            selectedProduct={selectedProduct}
            selectedOfferId={selectedOfferId}
            selectedLoanAmount={selectedLoanAmount}
            selectedLoanDuration={selectedLoanDuration}
          />
        </div>
      </Box>
    </ScrollArea>
  );
};
