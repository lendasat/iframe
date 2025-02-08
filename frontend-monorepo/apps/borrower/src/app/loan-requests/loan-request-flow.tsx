// Types
import { LoanProductOption } from "@frontend-monorepo/base-http-client";
import { ScrollArea } from "@radix-ui/themes";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Confirmation, ServiceType } from "./confirmation";
import { OffersTable } from "./offers-selection";
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

  useEffect(() => {
    const service = searchParams.get("product") as LoanProductOption;
    const offer = searchParams.get("offer");

    if (service && service !== selectedProduct) {
      setSelectedProduct(service);
      // Scroll to middle section if we have a service in URL
      setTimeout(() => {
        middleRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }

    if (offer && offer !== selectedOfferId) {
      setSelectedOfferId(offer);
      // Scroll to bottom section if we have both service and offer
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
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
      middleRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleOfferSelect = (offerId: string) => {
    setSelectedOfferId(offerId);
    // Update URL preserving the service parameter
    setSearchParams(prev => {
      prev.set("offer", offerId);
      return prev;
    });

    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  return (
    <ScrollArea className="h-screen" type="always" scrollbars="vertical">
      <div className="container mx-auto px-4 py-8">
        <ProductSelection
          onSelect={(option) => {
            console.log(`Selected ${option}`);
            handleProductOptionSelect(option);
          }}
          selectedOption={selectedProduct}
        />

        <div ref={middleRef}>
          <OffersTable
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
            // serviceType={selectedService}
            serviceType={undefined}
            offerId={undefined}
            // offerId={selectedOfferId}
          />
        </div>
      </div>
    </ScrollArea>
  );
};
