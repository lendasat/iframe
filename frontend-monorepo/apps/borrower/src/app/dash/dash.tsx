import { SectionCards } from "./cards";
import { ChartAreaInteractive } from "./charts";
import { ScrollArea } from "@radix-ui/themes";
import { DataTable } from "./table";
import { useAsync } from "react-use";
import { useBorrowerHttpClient } from "@frontend/http-client-borrower";
import MembersGetMemberSection from "../dashboard/members-get-members";

export const Dashboard = () => {
  const { getContracts } = useBorrowerHttpClient();

  const { loading, value: maybeContracts } = useAsync(async () => {
    return await getContracts();
  }, []);

  const contracts = maybeContracts || [];

  return (
    <ScrollArea className="h-[90vh] w-full">
      <SectionCards contracts={contracts} isLoading={loading} />
      <MembersGetMemberSection />
      <DataTable contracts={contracts} isLoading={loading} />
    </ScrollArea>
  );
};
