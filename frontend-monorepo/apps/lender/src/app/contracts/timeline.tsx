import { Badge, Button, Card, CardContent, ScrollArea } from "@frontend/shadcn";
import React, { useState } from "react";
import { contractStatusLabelColor } from "./bitcoin-loan-component";
import {
  Contract,
  ContractStatus,
  contractStatusToLabelString,
} from "@frontend/http-client-lender";
import { format } from "date-fns";
import { parseRFC3339Date } from "@frontend/http-client-lender/src/lib/utils";
import { LuCheck, LuClipboard, LuExternalLink } from "react-icons/lu";
import { getTxUrl } from "@frontend/ui-shared";

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
    <Card className={"border-none shadow-none"}>
      <CardContent className="pt-2">
        <ScrollArea className="h-80 w-full">
          <div className="p-4">
            <div className="space-y-4">
              {timelineEvents.map((event, index) => {
                let url = undefined;

                if (event.txid) {
                  if (
                    event.event === ContractStatus.CollateralConfirmed ||
                    event.event === ContractStatus.CollateralSeen ||
                    event.event === ContractStatus.Closed
                  ) {
                    url = `${import.meta.env.VITE_MEMPOOL_REST_URL}/tx/${event.txid}`;
                  } else {
                    url = getTxUrl(event.txid, contract?.loan_asset);
                  }
                }

                return (
                  <div key={index} className="relative pl-6 pb-4">
                    {/* Vertical line */}
                    {index < timelineEvents.length - 1 && (
                      <div className="absolute left-[9px] top-[24px] bottom-0 w-0.5 bg-gray-200" />
                    )}

                    {/* Timeline dot */}
                    <div
                      className={`absolute top-1 left-0 rounded-full w-[18px] h-[18px] ${currentStateColor} border-2 border-white ring-1 ring-gray-200`}
                    />

                    <div>
                      <div className="flex justify-between items-center">
                        <p className="font-medium">
                          {contractStatusToLabelString(event.event)}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {format(event.date, "MMM, dd yyyy - p")}
                        </Badge>
                      </div>
                      {event.txid && url && (
                        <div className="flex items-center justify-between space-x-2">
                          <p className="text-sm text-gray-600 mb-1">
                            Transaction id
                          </p>
                          <div className="flex items-center">
                            <p className="text-xs text-gray-600 mt-1 font-mono mr-2">
                              {shortenTxid(event.txid)}
                            </p>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-6 w-6"
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
                              className="h-6 w-6"
                            >
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center"
                              >
                                <LuExternalLink className="h-4 w-4" />{" "}
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
                );
              })}
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export function contractStatusDescription(status: ContractStatus): string {
  switch (status) {
    case ContractStatus.Requested:
      return "Waiting for you to approve or decline";
    case ContractStatus.RenewalRequested:
      return "Waiting for you to approve or decline the renewal request";
    case ContractStatus.Approved:
      return "You have approved the contract.";
    case ContractStatus.CollateralSeen:
      return "We have seen the funding transaction in the mempool";
    case ContractStatus.CollateralConfirmed:
      return "The funding transaction is confirmed";
    case ContractStatus.PrincipalGiven:
      return "Your contract is fully open";
    case ContractStatus.RepaymentProvided:
      return "The borrower has repaid the loan principal";
    case ContractStatus.RepaymentConfirmed:
      return "You have received the repayment";
    case ContractStatus.Undercollateralized:
      return "The contract is under collateralized";
    case ContractStatus.Defaulted:
      return "The borrower had not paid back in time";
    case ContractStatus.Closing:
      return "The collateral is being spent";
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
      return "The contract request has been cancelled";
    case ContractStatus.RequestExpired:
    case ContractStatus.ApprovalExpired:
      return "The contract request has expired";
  }
}
