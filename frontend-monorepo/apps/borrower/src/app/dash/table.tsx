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
import { useAsync } from "react-use";
import {
  ContractStatus,
  getAllContractStatuses,
  isActionRequired,
  isContractClosed,
  isContractOpen,
  useBorrowerHttpClient,
} from "@frontend/http-client-borrower";
import { ContractOverview } from "../dashboard/dash-board";

export function DataTable() {
  const { getContracts } = useBorrowerHttpClient();

  const { value: maybeContracts } = useAsync(async () => {
    return await getContracts();
  }, []);

  const allContracts = maybeContracts || [];
  console.log(`allContracts ${allContracts.length}`);

  const openContracts = allContracts.filter((c) => {
    return isContractOpen(c.status);
  });
  console.log(`openContracts ${openContracts.length}`);

  const actionRequiredContracts = allContracts.filter((c) => {
    return isActionRequired(c.status);
  });
  console.log(`actionRequiredContracts ${actionRequiredContracts.length}`);

  const closedContracts = allContracts.filter((c) => {
    return isContractClosed(c.status);
  });

  return (
    <Tabs
      defaultValue="outline"
      className="flex w-full flex-col justify-start gap-2"
    >
      <div className="flex items-center justify-between px-4 lg:px-6">
        <Label htmlFor="view-selector" className="sr-only">
          View
        </Label>
        <Select defaultValue="outline">
          <SelectTrigger className="md:hidden flex w-fit" id="view-selector">
            <SelectValue placeholder="Select a view" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="action-required">Action Required</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <TabsList className="md:flex hidden">
          <TabsTrigger value="action-required">Action Required</TabsTrigger>
          <TabsTrigger value="open" className="gap-1">
            Open{" "}
            <Badge
              variant="secondary"
              className="flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground/30"
            >
              3
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="closed" className="gap-1">
            Closed{" "}
            <Badge
              variant="secondary"
              className="flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground/30"
            >
              2
            </Badge>
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent
        value="action-required"
        className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
      >
        <div className="overflow-hidden rounded-lg">
          <ContractOverview
            contracts={actionRequiredContracts}
            // TODO: this extra filter is unnecessary but this component is used elsewhere. We filtered the list already, and just say add another filter which is basicaly always true.
            contractStatusFilter={getAllContractStatuses()}
          />
        </div>
      </TabsContent>
      <TabsContent value="open" className="flex flex-col px-4 lg:px-6">
        <div className="overflow-hidden rounded-lg">
          <ContractOverview
            contracts={openContracts}
            contractStatusFilter={getAllContractStatuses()}
          />
        </div>
      </TabsContent>
      <TabsContent value="closed" className="flex flex-col px-4 lg:px-6">
        <div className="overflow-hidden rounded-lg">
          <ContractOverview
            contracts={closedContracts}
            contractStatusFilter={getAllContractStatuses()}
          />
        </div>
      </TabsContent>
    </Tabs>
  );
}
