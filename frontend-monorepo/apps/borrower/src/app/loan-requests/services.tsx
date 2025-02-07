import { Avatar, Box, Card, Flex, Text } from "@radix-ui/themes";

import { ServiceType } from "./confirmation";

interface ServiceCardProps {
  title: string;
  description: string;
  icon: string;
  onSelect: () => void;
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

interface ServiceSelectionProps {
  onServiceSelect: (type: ServiceType) => void;
  selectedService?: ServiceType;
}

interface Service {
  title: string;
  description: string;
  icon: string;
  type: ServiceType;
}

export const ServiceSelection = ({ onServiceSelect, selectedService }: ServiceSelectionProps) => {
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
