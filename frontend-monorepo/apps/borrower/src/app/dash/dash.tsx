import { SectionCards } from "./cards";
import { ScrollArea } from "@radix-ui/themes";
import { DataTable } from "./table";
import { useAsync } from "react-use";
import { useBorrowerHttpClient } from "@frontend/http-client-borrower";
import MembersGetMemberSection from "./members-get-members";
import { QuickActions } from "./quick-actions";

export const Dashboard = () => {
  const { getContracts } = useBorrowerHttpClient();

  const { loading, value: maybeContracts } = useAsync(async () => {
    return await getContracts();
  }, []);

  const contracts = maybeContracts || [];

  return (
    <ScrollArea className="h-[90vh] w-full">
      <SectionCards contracts={contracts} isLoading={loading} />
      <div
        className={"grid xs:grid-cols-1 grid-cols-1 lg:grid-cols-2 px-6 gap-4"}
      >
        <QuickActions />
        <MembersGetMemberSection />
      </div>
      <DataTable contracts={contracts} isLoading={loading} />
    </ScrollArea>
  );
};
