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
  isActionRequired,
  isContractClosed,
  isContractOpen,
  useBorrowerHttpClient,
} from "@frontend/http-client-borrower";
import { ContractOverview } from "./contract-overview";

export function DataTable() {
  const { getContracts } = useBorrowerHttpClient();

  const { value: maybeContracts } = useAsync(async () => {
    return await getContracts();
  }, []);

  const allContracts = maybeContracts || [];

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
