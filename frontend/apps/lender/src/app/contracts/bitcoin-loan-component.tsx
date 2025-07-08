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
  useLenderHttpClient,
} from "@frontend/http-client-lender";
import { useAsyncRetry } from "react-use";
import { ContractDetailsFooter } from "./contract-details-footer";
import { Chat } from "@frontend/nostr-chat";
import DisputesComponent from "./disputes/disputes";
import ExtensionSettings from "./extension-settings";
import { InstallmentTable } from "./installment-table";
import { LoanAssetHelper } from "@frontend/ui-shared";

export function contractStatusLabelColor(status?: ContractStatus): string {
  if (!status) {
    return `bg-gray-100 text-black-800`;
  }

  let color = "";

  switch (status) {
    case ContractStatus.Requested:
    case ContractStatus.RenewalRequested:
      color = "bg-blue-100 text-blue-800";
      break;
    case ContractStatus.Approved:
      color = "bg-indigo-100 text-indigo-800";
      break;
    case ContractStatus.CollateralSeen:
    case ContractStatus.CollateralConfirmed:
      color = "bg-violet-100 text-violet-800";
      break;
    case ContractStatus.PrincipalGiven:
      color = "bg-green-100 text-green-700";
      break;
    case ContractStatus.RepaymentProvided:
      color = "bg-teal-100 text-teal-800";
      break;
    case ContractStatus.RepaymentConfirmed:
      color = "bg-emerald-100 text-emerald-800";
      break;
    case ContractStatus.Undercollateralized:
      color = "bg-red-100 text-red-800";
      break;
    case ContractStatus.Defaulted:
      color = "bg-red-100 text-red-800";
      break;
    case ContractStatus.Closing:
      color = "bg-slate-100 text-slate-800";
      break;
    case ContractStatus.Closed:
      color = "bg-gray-100 text-gray-800";
      break;
    case ContractStatus.Extended:
      color = "bg-purple-100 text-purple-800";
      break;
    case ContractStatus.Rejected:
      color = "bg-rose-100 text-rose-800";
      break;
    case ContractStatus.DisputeBorrowerStarted:
    case ContractStatus.DisputeLenderStarted:
      color = "bg-orange-100 text-orange-800";
      break;
    case ContractStatus.DisputeBorrowerResolved:
    case ContractStatus.DisputeLenderResolved:
      color = "bg-lime-100 text-lime-800";
      break;
    case ContractStatus.Cancelled:
      color = "bg-zinc-100 text-zinc-800";
      break;
    case ContractStatus.RequestExpired:
      color = "bg-stone-100 text-stone-800";
      break;
    case ContractStatus.ApprovalExpired:
      color = "bg-neutral-100 text-neutral-800";
      break;
  }
  return color;
}

const EnhancedBitcoinLoan = () => {
  const { getContract } = useLenderHttpClient();
  const { id } = useParams();
  const { newChatNotification } = useLenderHttpClient();
  const { user } = useAuth();

  const {
    value: contract,
    loading,
    error,
    retry,
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
      <div className="max-w-full mx-4 pb-20 pt-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[680px]">
          {/* Main loan details (2/3 width on large screens) */}
          <div className="lg:col-span-2 h-full">
            <Card className="h-full flex flex-col">
              <CardHeader className="pb-2 flex-shrink-0">
                <div className="flex justify-between items-start">
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
                      contract?.status !== ContractStatus.Rejected &&
                      contract?.status !== ContractStatus.Cancelled &&
                      contract?.status !== ContractStatus.Closed &&
                      contract?.status !== ContractStatus.ClosedByLiquidation &&
                      contract?.status !== ContractStatus.ClosedByDefaulting &&
                      contract?.liquidation_status ===
                        LiquidationStatus.Healthy && (
                        <div className="flex items-center text-sm text-green-600">
                          <LuCircleCheck className="h-4 w-4 mr-1" />
                          <span>Healthy</span>
                        </div>
                      )}
                    {contract?.liquidation_status ===
                      LiquidationStatus.FirstMarginCall && (
                      <div className="flex items-center text-sm text-orange-600">
                        <LuCircleCheck className="h-4 w-4 mr-1" />
                        <span>Margin Call</span>
                      </div>
                    )}
                    {contract?.liquidation_status ===
                      LiquidationStatus.SecondMarginCall && (
                      <div className="flex items-center text-sm text-red-600">
                        <LuCircleCheck className="h-4 w-4 mr-1" />
                        <span>2nd Margin Call</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>

              <Tabs
                defaultValue="details"
                className="w-full flex-grow flex flex-col"
              >
                <div className="px-4 flex-shrink-0">
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
                        value="extension"
                        className="flex-1 whitespace-nowrap"
                      >
                        Extension Settings
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

                <div className="p-4">
                  <TabsContent value="details" className="m-0">
                    <Details contract={contract} />
                  </TabsContent>

                  <TabsContent value="collateral" className="m-0">
                    <Collateral contract={contract} />
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

                  <TabsContent value="extension" className="m-0">
                    <ExtensionSettings
                      contract={contract}
                      refreshContract={retry}
                    />
                  </TabsContent>

                  <TabsContent value="disputes" className="m-0">
                    <DisputesComponent
                      contractId={contract?.id}
                      refreshContract={retry}
                    />
                  </TabsContent>
                </div>
              </Tabs>

              <CardFooter className="flex-shrink-0 flex justify-between border-t pt-4">
                <ContractDetailsFooter
                  contract={contract}
                  loading={loading}
                  refreshContract={retry}
                />
              </CardFooter>
            </Card>
          </div>

          {/* Chat section (1/3 width on large screens) */}
          <div className="lg:col-span-1 h-full flex flex-col">
            <Chat
              contractId={contract?.id}
              counterpartyNpub={contract?.borrower_npub}
              counterpartyName={contract?.borrower.name}
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
