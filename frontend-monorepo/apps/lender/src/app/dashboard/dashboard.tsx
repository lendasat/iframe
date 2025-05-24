import { useLenderHttpClient } from "@frontend/http-client-lender";
import { Button } from "@frontend/shadcn";
import { Alert, AlertDescription, AlertTitle } from "@frontend/shadcn";
import { ScrollArea } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAsync } from "react-use";
import { InfoIcon } from "lucide-react";
import { DataTable } from "./table";
import { SectionCards } from "./section-cards";

const AlertBoard = () => {
  const navigate = useNavigate();

  return (
    <Alert>
      <InfoIcon className="h-4 w-4" />
      <AlertTitle>Attention</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        For your security, please create a backup of your seed phrase before
        proceeding.
        <Button onClick={() => navigate("/settings/wallet")} size={"sm"}>
          Go to Settings
        </Button>
      </AlertDescription>
    </Alert>
  );
};

function Dashboard() {
  const { getContracts } = useLenderHttpClient();

  const [hasMnemonicBackedUp, setHasMnemonicBackedUp] = useState(false);

  const { value: maybeContracts, loading: isLoading } = useAsync(async () => {
    return await getContracts();
  }, []);

  useEffect(() => {
    const storedBackup = localStorage.getItem("mnemonicBackedUp");
    if (storedBackup) {
      setHasMnemonicBackedUp(JSON.parse(storedBackup));
    }
  }, []);

  const contracts = maybeContracts || [];

  return (
    <ScrollArea className="h-[90vh] w-full">
      <SectionCards contracts={contracts} isLoading={isLoading} />

      {!hasMnemonicBackedUp && (
        <div className={"mt-4 mb-4 px-6"}>
          <AlertBoard />
        </div>
      )}

      <DataTable contracts={contracts} />
    </ScrollArea>
  );
}

export default Dashboard;
