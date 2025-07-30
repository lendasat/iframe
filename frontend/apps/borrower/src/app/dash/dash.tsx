import { SectionCards } from "./cards";
import { ScrollArea } from "@radix-ui/themes";
import { DataTable } from "./table";
import { useAsync } from "react-use";
import { useHttpClientBorrower } from "@frontend/http-client-borrower";
import MembersGetMemberSection from "./members-get-members";
import { QuickActions } from "./quick-actions";

export const Dashboard = () => {
  const { getContracts } = useHttpClientBorrower();

  const { loading, value: maybeContracts } = useAsync(async () => {
    const allContracts = [];
    let currentPage = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      const response = await getContracts({ page: currentPage, limit: 50 });
      allContracts.push(...response.data);

      hasMorePages = currentPage < response.total_pages;
      currentPage++;
    }

    return allContracts;
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
      <DataTable contracts={contracts} />
    </ScrollArea>
  );
};
