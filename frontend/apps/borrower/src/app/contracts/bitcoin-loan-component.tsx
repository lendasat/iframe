import { LuCircleCheck } from "react-icons/lu";
import {
  Badge,
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  ScrollArea,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@frontend/shadcn";
import { Details } from "./details";
import { Collateral } from "./collateral";
import { Timeline } from "./timeline";
import { useParams } from "react-router-dom";
import {
  ContractStatus,
  contractStatusToLabelString,
  LiquidationStatus,
  useAuth,
  useHttpClientBorrower,
} from "@frontend/http-client-borrower";
import { useAsyncRetry } from "react-use";
import { ContractDetailsFooter } from "./contract-details-footer";
import { Chat } from "@frontend/nostr-chat";
import DisputesComponent from "./disputes/disputes";
import { InstallmentTable } from "./installment-table";
import { LoanAssetHelper } from "@frontend/ui-shared";

export function contractStatusLabelColor(status?: ContractStatus): string {
  if (!status) {
    return `bg-gray-100 text-black-800`;
  }

  switch (status) {
    case ContractStatus.Requested:
      return "bg-blue-100 text-blue-800";
    case ContractStatus.Approved:
      return "bg-indigo-100 text-indigo-800";
    case ContractStatus.CollateralSeen:
    case ContractStatus.CollateralConfirmed:
      return "bg-violet-100 text-violet-800";
    case ContractStatus.PrincipalGiven:
      return "bg-green-100 text-green-700";
    case ContractStatus.RepaymentProvided:
      return "bg-teal-100 text-teal-800";
    case ContractStatus.RepaymentConfirmed:
      return "bg-emerald-100 text-emerald-800";
    case ContractStatus.Undercollateralized:
      return "bg-red-100 text-red-800";
    case ContractStatus.Defaulted:
      return "bg-red-100 text-red-800";
    case ContractStatus.Closing:
      return "bg-slate-100 text-slate-800";
    case ContractStatus.Closed:
      return "bg-gray-100 text-gray-800";
    case ContractStatus.ClosedByDefaulting:
      return "bg-gray-100 text-gray-800";
    case ContractStatus.ClosedByLiquidation:
      return "bg-gray-100 text-gray-800";
    case ContractStatus.Extended:
      return "bg-purple-100 text-purple-800";
    case ContractStatus.Rejected:
      return "bg-rose-100 text-rose-800";
    case ContractStatus.DisputeBorrowerStarted:
    case ContractStatus.DisputeLenderStarted:
      return "bg-orange-100 text-orange-800";
    case ContractStatus.Cancelled:
      return "bg-zinc-100 text-zinc-800";
    case ContractStatus.RequestExpired:
      return "bg-stone-100 text-stone-800";
    case ContractStatus.ApprovalExpired:
      return "bg-neutral-100 text-neutral-800";
    case ContractStatus.CollateralRecoverable:
      return "bg-amber-100 text-amber-800";
    case ContractStatus.ClosedByRecovery:
      return "bg-gray-100 text-gray-800";
  }
}

const EnhancedBitcoinLoan = () => {
  const { getContract } = useHttpClientBorrower();
  const { id } = useParams();
  const { newChatNotification } = useHttpClientBorrower();
  const { user } = useAuth();

  const {
    value: contract,
    loading,
    error,
    retry: refreshContract,
  } = useAsyncRetry(async () => {
    if (id) {
      return getContract(id);
    } else {
      return undefined;
    }
  }, [id]);

  if (error) {
    console.error(`Failed to load contract: ${error.message}`);
  }

  const currentStateColor = contractStatusLabelColor(contract?.status);
  const currentStateLabel =
    contract?.status &&
    contract?.installments &&
    contractStatusToLabelString(contract.status);

  const disputeOngoing =
    ContractStatus.DisputeBorrowerStarted === contract?.status ||
    ContractStatus.DisputeLenderStarted === contract?.status;

  return (
    <ScrollArea className="h-screen w-full overflow-auto">
      <div className="mx-4 max-w-full pb-20 pt-5">
        <div className="grid min-h-[680px] grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Main loan details (2/3 width on large screens) */}
          <div className="h-full lg:col-span-2">
            <Card className="flex h-full flex-col">
              <CardHeader className="flex-shrink-0 pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl font-bold">
                      Collateralized Loan Contract
                    </CardTitle>
                    <CardDescription>
                      Secure lending agreement between parties
                    </CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={`color: ${currentStateColor}`}>
                      {currentStateLabel ? (
                        currentStateLabel
                      ) : (
                        <Skeleton className="h-4 w-[50px]" />
                      )}
                    </Badge>
                    {!disputeOngoing &&
                      contract?.status !== ContractStatus.Requested &&
                      contract?.status !== ContractStatus.Cancelled &&
                      contract?.status !== ContractStatus.Defaulted &&
                      contract?.status !== ContractStatus.Closed &&
                      contract?.status !== ContractStatus.ClosedByDefaulting &&
                      contract?.status !== ContractStatus.ClosedByLiquidation &&
                      contract?.liquidation_status ===
                        LiquidationStatus.Healthy && (
                        <div className="flex items-center text-sm text-green-600">
                          <LuCircleCheck className="mr-1 h-4 w-4" />
                          <span>Healthy</span>
                        </div>
                      )}
                    {contract?.liquidation_status ===
                      LiquidationStatus.FirstMarginCall && (
                      <div className="flex items-center text-sm text-orange-600">
                        <LuCircleCheck className="mr-1 h-4 w-4" />
                        <span>Margin Call</span>
                      </div>
                    )}
                    {contract?.liquidation_status ===
                      LiquidationStatus.SecondMarginCall && (
                      <div className="flex items-center text-sm text-red-600">
                        <LuCircleCheck className="mr-1 h-4 w-4" />
                        <span>2nd Margin Call</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>

              <Tabs
                defaultValue="details"
                className="flex w-full flex-grow flex-col"
              >
                <div className="flex-shrink-0 px-4">
                  <div
                    className="w-full overflow-x-scroll cursor-grab active:cursor-grabbing scrollbar-hide"
                    onMouseDown={(e) => {
                      const slider = e.currentTarget;
                      let isDown = true;
                      let startX = e.pageX;
                      let scrollLeft = slider.scrollLeft;

                      // Prevent text selection and default drag behavior
                      e.preventDefault();
                      slider.style.cursor = "grabbing";

                      const handleMouseMove = (e: MouseEvent) => {
                        if (!isDown) return;
                        e.preventDefault();
                        const x = e.pageX;
                        const walk = (x - startX) * 2;
                        slider.scrollLeft = scrollLeft - walk;
                      };

                      const handleMouseUp = () => {
                        isDown = false;
                        slider.style.cursor = "grab";
                        document.removeEventListener(
                          "mousemove",
                          handleMouseMove,
                        );
                        document.removeEventListener("mouseup", handleMouseUp);
                      };

                      document.addEventListener("mousemove", handleMouseMove);
                      document.addEventListener("mouseup", handleMouseUp);
                    }}
                    onWheel={(e) => {
                      const slider = e.currentTarget;
                      e.preventDefault();
                      slider.scrollLeft += e.deltaY;
                    }}
                  >
                    <TabsList className="flex w-full min-w-max justify-between gap-1 p-1">
                      <TabsTrigger
                        value="details"
                        className="flex-1 whitespace-nowrap"
                      >
                        Loan Details
                      </TabsTrigger>
                      <TabsTrigger
                        value="collateral"
                        className="flex-1 whitespace-nowrap"
                      >
                        Collateral
                      </TabsTrigger>
                      <TabsTrigger
                        value="timeline"
                        className="flex-1 whitespace-nowrap"
                      >
                        Timeline
                      </TabsTrigger>
                      <TabsTrigger
                        value="installments"
                        className="flex-1 whitespace-nowrap"
                      >
                        Installments
                      </TabsTrigger>
                      <TabsTrigger
                        value="disputes"
                        className="flex-1 whitespace-nowrap"
                      >
                        Disputes
                      </TabsTrigger>
                    </TabsList>
                  </div>
                </div>

                {/* Inner ScrollArea for tab content */}
                {/*<ScrollArea>*/}
                <div className="p-4">
                  <TabsContent value="details" className="m-0">
                    <Details contract={contract} />
                  </TabsContent>

                  <TabsContent value="collateral" className="m-0">
                    <Collateral
                      contract={contract}
                      refreshContract={refreshContract}
                    />
                  </TabsContent>

                  <TabsContent value="timeline" className="m-0">
                    <Timeline contract={contract} />
                  </TabsContent>

                  <TabsContent value="installments" className="m-0">
                    <InstallmentTable
                      installments={contract?.installments ?? []}
                      isFiatLoan={
                        contract?.loan_asset
                          ? LoanAssetHelper.isFiat(contract?.loan_asset)
                          : false
                      }
                      loanAsset={contract?.loan_asset}
                    />
                  </TabsContent>

                  <TabsContent value="disputes" className="m-0">
                    <DisputesComponent contractId={contract?.id} />
                  </TabsContent>
                </div>
                {/*</ScrollArea>*/}
              </Tabs>

              <CardFooter className="flex flex-shrink-0 justify-between border-t pt-4">
                <ContractDetailsFooter
                  contract={contract}
                  loading={loading}
                  refreshContract={refreshContract}
                />
              </CardFooter>
            </Card>
          </div>

          {/* Chat section (1/3 width on large screens) */}
          <div className="flex h-full flex-col lg:col-span-1">
            <Chat
              contractId={contract?.id}
              counterpartyNpub={contract?.lender_npub}
              counterpartyName={contract?.lender.name}
              personalName={user?.name}
              onNewMsgSent={async () => {
                if (contract) {
                  await newChatNotification({
                    contract_id: contract?.id,
                  });
                }
              }}
            />
          </div>
        </div>
      </div>
    </ScrollArea>
  );
};

export default EnhancedBitcoinLoan;
