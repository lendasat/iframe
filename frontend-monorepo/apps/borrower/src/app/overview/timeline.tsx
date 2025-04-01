import { Badge, Button, CardContent } from "@frontend/shadcn";
import React, { useState } from "react";
import { contractStatusLabelColor } from "./bitcoin-loan-component";
import {
  Contract,
  ContractStatus,
  contractStatusToLabelString,
} from "@frontend/http-client-borrower";
import { format } from "date-fns";
import { parseRFC3339Date } from "@frontend/http-client-borrower/src/lib/utils";
import { LuCheck, LuClipboard, LuExternalLink } from "react-icons/lu";

const shortenTxid = (txid: string) => {
  const firstSix = txid.slice(0, 4);
  const lastFour = txid.slice(-4);

  return `${firstSix}...${lastFour}`;
};

export interface TimelineEvent {
  date: Date;
  event: ContractStatus;
  txid?: string;
}

interface TimelineProps {
  contract?: Contract;
}

export const Timeline = ({ contract }: TimelineProps) => {
  const [txidCopied, setTxidCopied] = useState(false);
  const unparsedTimelineEvents = contract?.timeline ? contract?.timeline : [];
  const timelineEvents: TimelineEvent[] = unparsedTimelineEvents?.map((t) => {
    const date = parseRFC3339Date(t.date) || new Date();
    return {
      date,
      event: t.event,
      txid: t.txid,
    };
  });

  timelineEvents?.sort((a, b) => {
    return a.date.getTime() - b.date.getTime();
  });

  const currentStateColor = contractStatusLabelColor(contract?.status);

  const handleCopyTxid = async (txid: string) => {
    await navigator.clipboard.writeText(txid);
    setTxidCopied(true);
    setTimeout(() => setTxidCopied(false), 2000);
  };

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
                <p className="font-medium">
                  {contractStatusToLabelString(event.event)}
                </p>
                <Badge variant="outline" className="text-xs">
                  {format(event.date, "MMM, do yyyy - p")}
                </Badge>
              </div>
              {event.txid && (
                <div className="flex items-center justify-between space-x-2">
                  <p className="text-sm text-gray-600 mb-1">Transaction id</p>
                  <div className="flex items-center space-x-2">
                    <p className="text-xs text-gray-600 mt-1 font-mono">
                      {shortenTxid(event.txid)}
                    </p>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleCopyTxid(event.txid || "")}
                    >
                      {txidCopied ? (
                        <LuCheck className="h-4 w-4" />
                      ) : (
                        <LuClipboard className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      asChild
                      size={"icon"}
                      variant={"ghost"}
                      className="h-6 w-6 ml-1"
                    >
                      <a
                        href={`${import.meta.env.VITE_MEMPOOL_REST_URL}/tx/${event.txid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center"
                      >
                        <LuExternalLink className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              )}

              <p className="text-sm text-gray-600 mb-1">
                {contractStatusDescription(event.event)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </CardContent>
  );
};

export function contractStatusDescription(status: ContractStatus): string {
  switch (status) {
    case ContractStatus.Requested:
      return "Waiting for your request to be approved";
    case ContractStatus.RenewalRequested:
      return "Waiting for your renewal request to be approved";
    case ContractStatus.Approved:
      return "The lender has approved your contract.";
    case ContractStatus.CollateralSeen:
      return "We have seen your funding transaction in the mempool";
    case ContractStatus.CollateralConfirmed:
      return "Your funding transaction is confirmed";
    case ContractStatus.PrincipalGiven:
      return "Your contract is fully open";
    case ContractStatus.RepaymentProvided:
      return "You have repaid your contract";
    case ContractStatus.RepaymentConfirmed:
      return "The lender has received the repayment";
    case ContractStatus.Undercollateralized:
      return "Your contract is under collateralilzed";
    case ContractStatus.Defaulted:
      return "You have not paid back in time";
    case ContractStatus.Closing:
      return "Your collateral is being spent";
    case ContractStatus.Closed:
      return "Your contract is closed";
    case ContractStatus.Extended:
      return "The contract has been extended";
    case ContractStatus.Rejected:
      return "The contract request has been rejected";
    case ContractStatus.DisputeBorrowerStarted:
    case ContractStatus.DisputeLenderStarted:
      return "A dispute has been opened";
    case ContractStatus.DisputeBorrowerResolved:
    case ContractStatus.DisputeLenderResolved:
      return "The dispute has been resolved";
    case ContractStatus.Cancelled:
      return "The contract reuquest has been cancelled";
    case ContractStatus.RequestExpired:
    case ContractStatus.ApprovalExpired:
      return "The contract request has expired";
  }
}
