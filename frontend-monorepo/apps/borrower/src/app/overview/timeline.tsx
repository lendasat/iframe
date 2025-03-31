import { Badge, CardContent } from "@frontend/shadcn";
import React from "react";
import { contractStatusLabelColor } from "./bitcoin-loan-component";
import {
  Contract,
  contractStatusToLabelString,
} from "@frontend/http-client-borrower";

// Sample timeline events
const timelineEvents = [
  {
    date: "2025-02-01",
    event: "Contract Created",
    description: "Loan request submitted by Borrower",
    state: "REQUEST",
  },
  {
    date: "2025-02-03",
    event: "Terms Approved",
    description: "Lender approved loan terms",
    state: "APPROVED",
  },
  {
    date: "2025-02-05",
    event: "Collateral Deposited",
    description: "0.03842120 BTC deposited as collateral",
    state: "FUNDED",
  },
  {
    date: "2025-02-07",
    event: "Principal Sent",
    description: "$11 USDC sent to borrower",
    state: "ACTIVE",
  },
];

interface TimelineProps {
  contract?: Contract;
}

export const Timeline = ({ contract }: TimelineProps) => {
  const currentStateColor = contractStatusLabelColor(contract?.status);
  const currentStateLabel =
    contract?.status && contractStatusToLabelString(contract.status);

  return (
    <CardContent className="pt-2">
      <h3 className="text-lg font-medium mb-4">Loan Timeline</h3>

      <div className="space-y-4">
        {timelineEvents.map((event, index) => (
          <div key={index} className="relative pl-6 pb-4">
            {/* Vertical line */}
            {index < timelineEvents.length - 1 && (
              <div className="absolute left-[9px] top-[24px] bottom-0 w-0.5 bg-gray-200"></div>
            )}

            {/* Timeline dot */}
            <div
              className={`absolute top-1 left-0 rounded-full w-[18px] h-[18px] ${currentStateColor} border-2 border-white ring-1 ring-gray-200`}
            ></div>

            <div>
              <div className="flex justify-between items-center">
                <p className="font-medium">{event.event}</p>
                <Badge variant="outline" className="text-xs">
                  {event.date}
                </Badge>
              </div>
              <p className="text-sm text-gray-600 mt-1">{event.description}</p>
            </div>
          </div>
        ))}
      </div>
    </CardContent>
  );
};
