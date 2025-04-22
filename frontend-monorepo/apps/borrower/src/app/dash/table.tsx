import {
  Badge,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@frontend/shadcn";
import {
  Contract,
  isActionRequired,
  isContractClosed,
  isContractOpen,
} from "@frontend/http-client-borrower";
import { ContractOverview } from "./contract-overview";

interface DataTableProps {
  contracts: Contract[];
  isLoading: boolean;
}

export function DataTable({
  contracts: allContracts,
  isLoading,
}: DataTableProps) {
  const openContracts = allContracts.filter((c) => {
    return isContractOpen(c.status);
  });

  const actionRequiredContracts = allContracts.filter((c) => {
    return isActionRequired(c.status);
  });

  const closedContracts = allContracts.filter((c) => {
    return isContractClosed(c.status);
  });

  return (
    <Tabs
      defaultValue={
        actionRequiredContracts.length > 0 ? "open" : "action-required"
      }
      className="flex w-full flex-col justify-start gap-0"
    >
      <div className="flex items-center justify-between px-4 lg:px-6">
        <Label htmlFor="view-selector" className="sr-only">
          View
        </Label>
        <TabsList className="flex">
          <TabsTrigger value="action-required" className="gap-1">
            Action Required{" "}
            <Badge
              variant="secondary"
              className="flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground/30"
            >
              {actionRequiredContracts.length > 0
                ? actionRequiredContracts.length
                : ""}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="open" className="gap-1">
            Open{" "}
            <Badge
              variant="secondary"
              className="flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground/30"
            >
              {openContracts.length > 0 ? openContracts.length : ""}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="closed" className="gap-1">
            Closed{" "}
            <Badge
              variant="secondary"
              className="flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground/30"
            >
              {closedContracts.length > 0 ? closedContracts.length : ""}
            </Badge>
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent
        value="action-required"
        className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
      >
        <div className="overflow-hidden rounded-lg">
          <ContractOverview contracts={actionRequiredContracts} />
        </div>
      </TabsContent>
      <TabsContent value="open" className="flex flex-col px-4 lg:px-6">
        <div className="overflow-hidden rounded-lg">
          <ContractOverview contracts={openContracts} />
        </div>
      </TabsContent>
      <TabsContent value="closed" className="flex flex-col px-4 lg:px-6">
        <div className="overflow-hidden rounded-lg">
          <ContractOverview contracts={closedContracts} />
        </div>
      </TabsContent>
    </Tabs>
  );
}
