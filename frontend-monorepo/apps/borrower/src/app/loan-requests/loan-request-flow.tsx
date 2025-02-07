// Types
import { Avatar, Box, Card, Flex, ScrollArea, Table, Text } from "@radix-ui/themes";
import { useEffect, useRef, useState } from "react";
import { FaSearch } from "react-icons/fa";
import { useSearchParams } from "react-router-dom";

type ServiceType = "stable" | "card" | "fiat";

interface Service {
  title: string;
  description: string;
  icon: string;
  type: ServiceType;
}

interface Offer {
  id: number;
  lender: string;
  amount: string;
  duration: string;
  ltv: string;
  interestRate: string;
  coin: string;
}

interface ServiceCardProps {
  title: string;
  description: string;
  icon: string;
  onSelect: () => void;
}

interface ServiceSelectionProps {
  onServiceSelect: (type: ServiceType) => void;
  selectedService?: ServiceType;
}

interface OffersTableProps {
  serviceType?: ServiceType;
  onOfferSelect: (offerId: number) => void;
  selectedOffer?: number;
}

interface ConfirmationProps {
  serviceType?: ServiceType;
  offerId?: number;
}

// Components with types
const ServiceCard = ({ title, description, icon, onSelect }: ServiceCardProps) => (
  <Card
    className="p-6 rounded-lg border border-violet-200 hover:border-violet-400 cursor-pointer transition-all"
    onClick={onSelect}
  >
    <Flex gap="3" align="center">
      <Avatar
        size="3"
        src={icon}
        radius="full"
        fallback="T"
      />
      <Box>
        <Text as="div" size="2" weight="bold">
          {title}
        </Text>
        <Text as="div" size="2" color="gray">
          {description}
        </Text>
      </Box>
    </Flex>
  </Card>
);

const ServiceSelection = ({ onServiceSelect, selectedService }: ServiceSelectionProps) => {
  const services: Service[] = [
    {
      title: "Stablecoin Loan",
      description: "Borrow USDT, USDC, or DAI",
      icon: "💰",
      type: "stable",
    },
    {
      title: "Debit Card",
      description: "Get a crypto-backed debit card",
      icon: "💳",
      type: "card",
    },
    {
      title: "Fiat Loan",
      description: "Borrow in your local currency",
      icon: "🏦",
      type: "fiat",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
      {services.map((service) => (
        <ServiceCard
          key={service.type}
          {...service}
          onSelect={() => onServiceSelect(service.type)}
        />
      ))}
    </div>
  );
};

const OffersTable = ({ serviceType, onOfferSelect, selectedOffer }: OffersTableProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  const offers: Offer[] = [
    {
      id: 1,
      lender: "Alice The Lender",
      amount: "$1 - $99,993",
      duration: "7 days - 1 year",
      ltv: "50.00%",
      interestRate: "12.00%",
      coin: "USDT Ethereum",
    },
    // Add more offers...
  ];

  if (!serviceType) return null;

  return (
    <div className="mb-16">
      <div className="relative mb-6">
        <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search offers..."
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>Lender</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Amount</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Duration</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>LTV</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Interest Rate</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Coin</Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {offers.map((offer) => (
            <Table.Row
              key={offer.id}
              className="cursor-pointer hover:bg-violet-50"
              onClick={() => onOfferSelect(offer.id)}
            >
              <Table.Cell>{offer.lender}</Table.Cell>
              <Table.Cell>{offer.amount}</Table.Cell>
              <Table.Cell>{offer.duration}</Table.Cell>
              <Table.Cell>{offer.ltv}</Table.Cell>
              <Table.Cell>{offer.interestRate}</Table.Cell>
              <Table.Cell>{offer.coin}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </div>
  );
};

const Confirmation = ({ serviceType, offerId }: ConfirmationProps) => {
  if (!serviceType || !offerId) return null;

  const renderForm = () => {
    switch (serviceType) {
      case "stable":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Wallet Address</h3>
            <input
              type="text"
              placeholder="Enter your wallet address"
              className="w-full p-2 border border-gray-200 rounded-lg"
            />
          </div>
        );
      case "fiat":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Bank Details</h3>
            <input
              type="text"
              placeholder="Account number"
              className="w-full p-2 border border-gray-200 rounded-lg"
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6 border border-gray-200 rounded-lg">
      <h2 className="text-xl font-semibold mb-6">Confirm Your Application</h2>
      {renderForm()}
    </div>
  );
};

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
        <ServiceSelection
          onServiceSelect={handleServiceSelect}
          selectedService={selectedService}
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
