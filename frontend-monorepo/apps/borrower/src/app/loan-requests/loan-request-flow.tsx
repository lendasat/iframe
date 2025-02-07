// Types
import { ScrollArea } from "@radix-ui/themes";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Confirmation, ServiceType } from "./confirmation";
import { OffersTable } from "./offers-selection";
import { ProductSelection } from "./product-options";

export const LoanRequestFlow = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  // Initialize state from URL parameters
  const [selectedService, setSelectedService] = useState<ServiceType | undefined>(
    searchParams.get("service") as ServiceType || undefined,
  );
  const [selectedOffer, setSelectedOffer] = useState<number | undefined>(
    searchParams.get("offer") ? Number(searchParams.get("offer")) : undefined,
  );

  useEffect(() => {
    const service = searchParams.get("service") as ServiceType;
    const offer = searchParams.get("offer");

    if (service && service !== selectedService) {
      setSelectedService(service);
      // Scroll to middle section if we have a service in URL
      setTimeout(() => {
        middleRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }

    if (offer && Number(offer) !== selectedOffer) {
      setSelectedOffer(Number(offer));
      // Scroll to bottom section if we have both service and offer
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [searchParams, selectedService, selectedOffer]);

  // Add refs for each section
  const middleRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleServiceSelect = (type: ServiceType) => {
    setSelectedService(type);
    setSelectedOffer(undefined);
    // Update URL
    setSearchParams({ service: type });
    setTimeout(() => {
      middleRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleOfferSelect = (offerId: number) => {
    setSelectedOffer(offerId);
    // Update URL preserving the service parameter
    setSearchParams(prev => {
      prev.set("offer", offerId.toString());
      return prev;
    });

    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  return (
    <ScrollArea type="always" scrollbars="vertical">
      <div className="container mx-auto px-4 py-8">
        <ProductSelection
          onSelect={(service) => {
            console.log(`Selected ${service}`);
            // handleServiceSelect
          }}
          selectedOption={undefined}
          // selectedService={selectedService}
        />

        <div ref={middleRef}>
          <OffersTable
            serviceType={selectedService}
            onOfferSelect={handleOfferSelect}
            selectedOffer={selectedOffer}
          />
        </div>

        <div ref={bottomRef}>
          <Confirmation
            serviceType={selectedService}
            offerId={selectedOffer}
          />
        </div>
      </div>
    </ScrollArea>
  );
};
