import { SectionCards } from "./cards";
import { ChartAreaInteractive } from "./charts";
import { ScrollArea } from "@radix-ui/themes";
import { DataTable } from "./table";

export const Dashboard = () => {
  return (
    <ScrollArea className="h-[90vh] w-full">
      <SectionCards />
      <DataTable />
    </ScrollArea>
  );
};
