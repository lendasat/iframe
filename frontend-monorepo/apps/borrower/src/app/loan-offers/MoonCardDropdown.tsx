import type { UserCardDetail } from "@frontend/http-client-borrower";
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
          className="text-font dark:text-font-dark dark:bg-dark-700 h-10 w-full rounded-lg border p-3 text-sm shadow-none outline-none focus-visible:outline-none"
        />

        <Select.Content
          highContrast
          color="purple"
          className="z-50 text-sm font-normal"
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
