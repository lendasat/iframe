import { Table } from "@radix-ui/themes";
import { useState } from "react";
import { FaSearch } from "react-icons/fa";

import { ServiceType } from "./confirmation";

interface Offer {
  id: number;
  lender: string;
  amount: string;
  duration: string;
  ltv: string;
  interestRate: string;
  coin: string;
}

interface OffersTableProps {
  serviceType?: ServiceType;
  onOfferSelect: (offerId: number) => void;
  selectedOffer?: number;
}

export const OffersTable = ({ serviceType, onOfferSelect, selectedOffer }: OffersTableProps) => {
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
