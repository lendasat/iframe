import {
  Badge,
  Button,
  Card,
  CardContent,
  ScrollArea,
  Sheet,
  SheetContent,
} from "@frontend/shadcn";
import { useState } from "react";
import { InstallmentSheetContent } from "./installment-sheet-content";
import { contractStatusLabelColor } from "./bitcoin-loan-component";
import {
  Contract,
  ContractStatus,
  contractStatusToLabelString,
  TimelineEventKind,
  TimelineEventType,
  Installment,
} from "@frontend/http-client-lender";
import { format } from "date-fns";
import { parseRFC3339Date } from "@frontend/http-client-lender/src/lib/utils";
import { LuCheck, LuClipboard, LuExternalLink } from "react-icons/lu";
import { getTxUrl, LoanAssetHelper } from "@frontend/ui-shared";
import { CircleCheck } from "lucide-react";

const shortenTxid = (txid: string) => {
  const firstSix = txid.slice(0, 4);
  const lastFour = txid.slice(-4);

  return `${firstSix}...${lastFour}`;
};

export interface TimelineEvent {
  date: Date;
  event: TimelineEventKind;
  txid?: string;
}

interface TimelineProps {
  contract?: Contract;
}

export const Timeline = ({ contract }: TimelineProps) => {
  const [txidCopied, setTxidCopied] = useState(false);
  const [selectedInstallment, setSelectedInstallment] =
    useState<Installment | null>(null);

  const handleInstallmentClick = (installmentId: string) => {
    const installment = contract?.installments?.find(
      (i) => i.id === installmentId,
    );
    if (installment) {
      setSelectedInstallment(installment);
    }
  };
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
                if (
                  event.event.type === TimelineEventType.ContractStatusChange &&
                  event.event.status !== undefined
                ) {
                  let url = undefined;

                  if (event.txid) {
                    if (
                      event.event.status ===
                        ContractStatus.CollateralConfirmed ||
                      event.event.status === ContractStatus.CollateralSeen ||
                      event.event.status === ContractStatus.Closed ||
                      event.event.status ===
                        ContractStatus.ClosedByLiquidation ||
                      event.event.status === ContractStatus.ClosedByDefaulting
                    ) {
                      url = `${import.meta.env.VITE_MEMPOOL_REST_URL}/tx/${event.txid}`;
                    } else {
                      url = getTxUrl(event.txid, contract?.loan_asset);
                    }
                  }

                  return (
                    <div
                      key={`${event.date.toString()}-${event.event.status}-${event.txid}`}
                      className="relative pb-4 pl-6"
                    >
                      {/* Vertical line */}
                      {index < timelineEvents.length - 1 && (
                        <div className="absolute bottom-0 left-[9px] top-[24px] w-0.5 bg-gray-200" />
                      )}

                      {/* Timeline dot */}
                      <div
                        className={`absolute left-0 top-1 h-[18px] w-[18px] rounded-full ${currentStateColor} border-2 border-white ring-1 ring-gray-200`}
                      />

                      <div>
                        <div className="flex items-center justify-between">
                          <p className="font-medium">
                            {contractStatusToLabelString(event.event.status)}
                          </p>
                          <Badge variant="outline" className="text-xs">
                            {format(event.date, "MMM, dd yyyy - p")}
                          </Badge>
                        </div>
                        {event.txid && url && (
                          <div className="flex items-center justify-between space-x-2">
                            <p className="mb-1 text-sm text-gray-600">
                              Transaction ID
                            </p>
                            <div className="flex items-center">
                              <p className="mr-2 mt-1 font-mono text-xs text-gray-600">
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

                        <p className="mb-1 text-sm text-gray-600">
                          {contractStatusDescription(event.event.status)}
                        </p>
                      </div>
                    </div>
                  );
                } else if (event.event.type === TimelineEventType.Installment) {
                  console.log(event.txid);

                  const url = event.txid
                    ? getTxUrl(event.txid, contract?.loan_asset)
                    : undefined;

                  return (
                    <div
                      key={`${event.date.toString()}-installment-${event.txid}`}
                      className="relative pb-4 pl-6"
                    >
                      {/* Vertical line */}
                      {index < timelineEvents.length - 1 && (
                        <div className="absolute bottom-0 left-[9px] top-[24px] w-0.5 bg-gray-200" />
                      )}

                      {/* Timeline dot */}
                      <div
                        className={`absolute left-0 top-1 h-[18px] w-[18px] rounded-full ${currentStateColor} border-2 border-white ring-1 ring-gray-200`}
                      />

                      <div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center font-medium">
                            {event.event.installment_id ? (
                              <button
                                type="button"
                                onClick={() =>
                                  handleInstallmentClick(
                                    event.event.installment_id!,
                                  )
                                }
                                className="cursor-pointer text-blue-600 underline hover:text-blue-800"
                              >
                                Installment Paid
                              </button>
                            ) : (
                              "Installment Paid"
                            )}
                            {event.event.is_confirmed && (
                              <CircleCheck className="ml-2 h-4 w-4" />
                            )}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {format(event.date, "MMM, dd yyyy - p")}
                          </Badge>
                        </div>
                        {event.txid && url && (
                          <div className="flex items-center justify-between space-x-2">
                            <p className="mb-1 text-sm text-gray-600">
                              Transaction ID
                            </p>
                            <div className="flex items-center">
                              <p className="mr-2 mt-1 font-mono text-xs text-gray-600">
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
                      </div>
                    </div>
                  );
                }
              })}
            </div>
          </div>
        </ScrollArea>

        <Sheet
          open={!!selectedInstallment}
          onOpenChange={(open) => !open && setSelectedInstallment(null)}
        >
          <SheetContent>
            {selectedInstallment && (
              <InstallmentSheetContent
                installment={selectedInstallment}
                isFiatLoan={
                  contract?.loan_asset
                    ? LoanAssetHelper.isFiat(contract.loan_asset)
                    : false
                }
                loanAsset={contract?.loan_asset}
              />
            )}
          </SheetContent>
        </Sheet>
      </CardContent>
    </Card>
  );
};

export function contractStatusDescription(status: ContractStatus): string {
  switch (status) {
    case ContractStatus.Requested:
      return "Waiting for you to approve or decline.";
    case ContractStatus.Approved:
      return "You have approved the contract.";
    case ContractStatus.CollateralSeen:
      return "We have seen the funding transaction in mempool.";
    case ContractStatus.CollateralConfirmed:
      return "The funding transaction is confirmed.";
    case ContractStatus.PrincipalGiven:
      return "Your contract is active.";
    case ContractStatus.RepaymentProvided:
      return "The borrower has repaid the contract in full.";
    case ContractStatus.RepaymentConfirmed:
      return "You have confirmed the repayment.";
    case ContractStatus.Undercollateralized:
      return "The contract is undercollateralized.";
    case ContractStatus.Defaulted:
      return "The borrower has not paid back in time.";
    case ContractStatus.ClosingByClaim:
      return "The collateral is being spent.";
    case ContractStatus.Closed:
      return "Your contract is closed.";
    case ContractStatus.ClosingByLiquidation:
    case ContractStatus.ClosingByDefaulting:
      return "Your are liquidating the contract.";
    case ContractStatus.ClosedByLiquidation:
      return "You have liquidated the contract.";
    case ContractStatus.ClosedByDefaulting:
      return "Your contract is closed due to defaulting.";
    case ContractStatus.Extended:
      return "The contract has been extended.";
    case ContractStatus.Rejected:
      return "The contract request has been rejected.";
    case ContractStatus.DisputeBorrowerStarted:
    case ContractStatus.DisputeLenderStarted:
      return "A dispute has been opened.";
    case ContractStatus.Cancelled:
      return "The contract request has been cancelled.";
    case ContractStatus.RequestExpired:
    case ContractStatus.ApprovalExpired:
      return "The contract request has expired.";
    case ContractStatus.CollateralRecoverable:
      return "The contract has been abandoned due to lender inactivity.";
    case ContractStatus.ClosingByRecovery:
      return "Your contract is being closed.";
    case ContractStatus.ClosedByRecovery:
      return "The contract has been closed after the borrower recovered their collateral.";
  }
}
