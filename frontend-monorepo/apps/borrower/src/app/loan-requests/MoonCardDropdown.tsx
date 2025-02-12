import type { UserCardDetail } from "@frontend-monorepo/http-client-borrower";
import { Box, Select } from "@radix-ui/themes";
import { useState } from "react";

export function MoonCardDropdown({
  onSelect,
  cards,
  loanAmount,
}: {
  onSelect: (cardId?: string) => void;
  cards: UserCardDetail[];
  loanAmount: number;
}) {
  // The card is identified by the card number.
  const [selectedCard, setSelectedCard] = useState<string>("New card");

  const handleChange = (cardId: string) => {
    const selectedValue = cards.find((c) => {
      return c.id === cardId;
    });

    setSelectedCard(selectedValue ? selectedValue.id : "New card");
    onSelect(selectedValue ? selectedValue.id : undefined);
  };

  // The maximum balance on a card is 5000 USD.
  const filteredCards = cards.filter((card: UserCardDetail) => {
    return card.balance + loanAmount <= 5000;
  });

  return (
    <Box className="w-full">
      <Select.Root value={selectedCard} onValueChange={handleChange}>
        <Select.Trigger
          variant={"surface"}
          className="w-full shadow-none focus-visible:outline-none p-3 outline-none h-10 text-font dark:text-font-dark text-sm border rounded-lg dark:bg-dark-700"
        />

        <Select.Content
          highContrast
          color="purple"
          className="font-normal text-sm z-50"
        >
          <Select.Item value="New card">Create New</Select.Item>
          {filteredCards.map((card: UserCardDetail) => (
            <Select.Item key={card.id} value={card.id}>
              **** **** **** {card.pan.slice(-4)}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
    </Box>
  );
}
