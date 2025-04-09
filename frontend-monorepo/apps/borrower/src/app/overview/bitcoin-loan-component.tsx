import { LuCircleCheck } from "react-icons/lu";
import {
  Badge,
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@frontend/shadcn";
import { Chat } from "./chat";
import { Details } from "./details";
import { Collateral } from "./collateral";
import { Timeline } from "./timeline";
import { useParams } from "react-router-dom";
import {
  ContractStatus,
  contractStatusToLabelString,
  LiquidationStatus,
  useBorrowerHttpClient,
} from "@frontend/http-client-borrower";
import { useAsync } from "react-use";
import { ContractDetailsFooter } from "./contract-details-footer";
import { ChatDrawer } from "@frontend/nostr-chat";

export function contractStatusLabelColor(status?: ContractStatus): string {
  if (!status) {
    return `bg-gray-100 text-black-800`;
  }

  switch (status) {
    case ContractStatus.Requested:
    case ContractStatus.RenewalRequested:
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
      return "bg-amber-100 text-amber-800";
    case ContractStatus.Defaulted:
      return "bg-red-100 text-red-800";
    case ContractStatus.Closing:
      return "bg-slate-100 text-slate-800";
    case ContractStatus.Closed:
      return "bg-gray-100 text-gray-800";
    case ContractStatus.Extended:
      return "bg-purple-100 text-purple-800";
    case ContractStatus.Rejected:
      return "bg-rose-100 text-rose-800";
    case ContractStatus.DisputeBorrowerStarted:
    case ContractStatus.DisputeLenderStarted:
      return "bg-orange-100 text-orange-800";
    case ContractStatus.DisputeBorrowerResolved:
    case ContractStatus.DisputeLenderResolved:
      return "bg-lime-100 text-lime-800";
    case ContractStatus.Cancelled:
      return "bg-zinc-100 text-zinc-800";
    case ContractStatus.RequestExpired:
      return "bg-stone-100 text-stone-800";
    case ContractStatus.ApprovalExpired:
      return "bg-neutral-100 text-neutral-800";
  }
}

const EnhancedBitcoinLoan = () => {
  const { getContract } = useBorrowerHttpClient();
  const { id } = useParams();
  const { newChatNotification } = useBorrowerHttpClient();

  const {
    value: contract,
    loading,
    error,
  } = useAsync(async () => {
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
    contract?.status && contractStatusToLabelString(contract.status);

  return (
    <div className="max-w-full mx-4 h-screen overflow-y-auto md:overflow-y-visible pb-10 pt-5">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main loan details (2/3 width on large screens) */}
        <div className="lg:col-span-2">
          <Card className="shadow-md h-full flex flex-col">
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
                      <>
                        <Skeleton className="h-4 w-[50px]" />
                      </>
                    )}
                  </Badge>
                  {contract?.status != ContractStatus.Requested &&
                    contract?.status != ContractStatus.Cancelled &&
                    contract?.status != ContractStatus.Closed &&
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
                <TabsList className="grid grid-cols-3 mb-2">
                  <TabsTrigger value="details">Loan Details</TabsTrigger>
                  <TabsTrigger value="collateral">Collateral</TabsTrigger>
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                </TabsList>
              </div>

              <div className="overflow-y-auto flex-grow">
                <TabsContent value="details" className="m-0">
                  <Details contract={contract} />
                </TabsContent>

                <TabsContent value="collateral" className="m-0">
                  <Collateral contract={contract} />
                </TabsContent>

                <TabsContent value="timeline" className="m-0">
                  <Timeline contract={contract} />
                </TabsContent>
              </div>
            </Tabs>

            <CardFooter className="flex-shrink-0 flex justify-between border-t pt-4">
              <ContractDetailsFooter contract={contract} loading={loading} />
            </CardFooter>
          </Card>
        </div>

        {/* Chat section (1/3 width on large screens) */}
        <div className="lg:col-span-1 pb-10">
          {/*TODO: implement chat*/}
          {/*<Chat />*/}
          {contract && (
            <ChatDrawer
              contractId={contract.id}
              counterpartyXPub={contract.lender_xpub}
              onNewMsgSent={async () => {
                await newChatNotification({
                  contract_id: contract.id,
                });
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default EnhancedBitcoinLoan;
