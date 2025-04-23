import React, { useState } from "react";
import { format } from "date-fns";
import {
  Badge,
  Button,
  ScrollArea,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  ScrollBar,
} from "@frontend/shadcn";
import {
  ContractDisputeStatus,
  DisputeInitiatorType,
  SenderType,
  useBorrowerHttpClient,
} from "@frontend/http-client-borrower";
import { useAsync } from "react-use";
import { DisputeDetails } from "./dispute-details";
import { LuPlus } from "react-icons/lu";
import StartDisputeDialog from "../start-dispute-dialog";

// Helper function to format the status into a human-readable string
export const formatStatus = (status?: ContractDisputeStatus): string => {
  switch (status) {
    case ContractDisputeStatus.DisputeStartedBorrower:
    case ContractDisputeStatus.DisputeStartedLender:
    case ContractDisputeStatus.InProgress:
      return "In progress";
    case ContractDisputeStatus.Closed:
      return "Resolved";
    case ContractDisputeStatus.Cancelled:
      return "Cancelled";
    default:
      return "Unknown status";
  }
};

// Helper function to get the status badge color
export const getStatusColor = (status?: ContractDisputeStatus): string => {
  if (status === ContractDisputeStatus.InProgress) return "bg-yellow-500";
  if (status && status.includes("Resolved")) return "bg-green-500";
  if (status === ContractDisputeStatus.Cancelled) return "bg-gray-500";
  return "bg-red-500"; // For disputes that have just started
};

// Helper function to format the initiator type
export const formatInitiatorType = (type?: DisputeInitiatorType): string => {
  return type === DisputeInitiatorType.Borrower ? "Borrower" : "Lender";
};

// Helper function to format sender type
export const formatSenderType = (type: SenderType): string => {
  switch (type) {
    case SenderType.Borrower:
      return "Borrower";
    case SenderType.Lender:
      return "Lender";
    case SenderType.PlatformAdmin:
      return "Admin";
    default:
      return "Unknown";
  }
};

interface DisputesComponentProps {
  contractId?: string;
}

export const DisputesComponent: React.FC<DisputesComponentProps> = ({
  contractId,
}) => {
  const { fetchDisputeWithMessages } = useBorrowerHttpClient();

  const [selectedDisputeId, setSelectedDisputeId] = useState<string | null>(
    null,
  );

  // Fetch all disputes for this contract
  const {
    value: disputes = [],
    loading,
    error,
  } = useAsync(async () => {
    if (!contractId) {
      return [];
    }

    const result = await fetchDisputeWithMessages(contractId);
    // Set the first dispute as selected by default if available
    if (result && result.length > 0) {
      setSelectedDisputeId(result[0].id);
    }
    return result || [];
  }, [contractId]);

  // Get the currently selected dispute
  const selectedDispute = selectedDisputeId
    ? disputes.find((d) => d.id === selectedDisputeId)
    : disputes.length > 0
      ? disputes[0]
      : undefined;

  if (error) {
    console.error(`Could not get disputes: ${error}`);
  }

  // If there are no disputes, show a simplified view with a create button
  if (disputes.length === 0 && !loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Disputes</CardTitle>
          <CardDescription>
            There are no disputes for this contract.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          {contractId ? (
            <StartDisputeDialog contractId={contractId}>
              <Button>
                <LuPlus className="mr-2 h-4 w-4" />
                Create Dispute
              </Button>
            </StartDisputeDialog>
          ) : (
            <Button disabled={true}>
              <LuPlus className="mr-2 h-4 w-4" />
              Create Dispute
            </Button>
          )}
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Contract Disputes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Scrollable horizontal list */}
        <ScrollArea className="w-full whitespace-nowrap rounded-md border">
          <div className="flex w-max space-x-4 p-4">
            {disputes.map((dispute) => (
              <div
                key={dispute.id}
                className={`p-3 rounded cursor-pointer hover:bg-slate-100 border w-[200px]
                ${selectedDisputeId === dispute.id ? "border-blue-500 bg-blue-50" : "border-gray-200"}`}
                onClick={() => setSelectedDisputeId(dispute.id)}
              >
                <div className="flex justify-between items-start">
                  <Badge
                    className={`${getStatusColor(dispute.status)} text-white mb-2`}
                  >
                    {formatStatus(dispute.status)}
                  </Badge>
                  <span className="text-xs text-gray-500">
                    {format(dispute.created_at, "MMM d, yyyy")}
                  </span>
                </div>
                <p className="text-sm font-medium">
                  By: {formatInitiatorType(dispute.initiator_type)}
                </p>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                  {dispute.reason}
                </p>
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Content area that changes based on selection */}
        <div className="min-h-32">
          {selectedDispute && <DisputeDetails dispute={selectedDispute} />}
        </div>
      </CardContent>
      <CardFooter>
        {contractId ? (
          <StartDisputeDialog contractId={contractId}>
            <Button>
              <LuPlus className="mr-2 h-4 w-4" />
              Create Dispute
            </Button>
          </StartDisputeDialog>
        ) : (
          <Button disabled={true}>
            <LuPlus className="mr-2 h-4 w-4" />
            Create Dispute
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default DisputesComponent;
