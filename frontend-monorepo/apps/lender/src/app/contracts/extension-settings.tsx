import { useState } from "react";
import {
  DollarSign,
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader,
} from "lucide-react";
import { Switch } from "@frontend/shadcn";
import { Label } from "@frontend/shadcn";
import { Slider } from "@frontend/shadcn";
import { Input } from "@frontend/shadcn";
import { Button } from "@frontend/shadcn";
import {
  Card,
  CardContent,
  CardFooter,
} from "@frontend/shadcn";
import { Alert, AlertDescription, AlertTitle } from "@frontend/shadcn";
import { Contract, useLenderHttpClient } from "@frontend/http-client-lender";
import { ONE_YEAR } from "@frontend/ui-shared";
import { toast } from "sonner";

interface ExtensionSettingsProps {
  contract?: Contract;
  refreshContract: () => void;
}

const LoanExtensionManager = ({
  contract,
  refreshContract,
}: ExtensionSettingsProps) => {
  const initialState = (contract?.extension_max_duration_days || 0) > 0;
  const [extensionsEnabled, setExtensionsEnabled] = useState(initialState);
  const [maxDays, setMaxDays] = useState(
    contract?.extension_max_duration_days || 30,
  );
  const initialInterestRate = (contract?.extension_interest_rate || 0.08) * 100;
  const [interestRate, setInterestRate] = useState(initialInterestRate);
  const [saved, setSaved] = useState(false);
  const { updateExtensionPolicy } = useLenderHttpClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!contract) {
      // shouldn't happen
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      let updateDaysTo = maxDays;
      if (!extensionsEnabled) {
        updateDaysTo = 0;
      }

      await updateExtensionPolicy(contract.id, {
        extension_interest_rate: interestRate / 100,
        extension_max_duration_days: updateDaysTo,
      });
      toast("Extension policy updated successfully.");
      setSaved(true);
      refreshContract();
    } catch (error) {
      setError(`${error}`);
      toast.error(`Failed updating extension policy ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className={"border-none shadow-none"}>
      <CardContent className="pt-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label
                htmlFor="extensions-toggle"
                className="text-base font-medium"
              >
                Enable Loan Extensions
              </Label>
              <p className="text-sm text-slate-500">
                Allow the borrower to extend their loan
              </p>
            </div>
            <Switch
              id="extensions-toggle"
              checked={extensionsEnabled}
              onCheckedChange={setExtensionsEnabled}
            />
          </div>

          {extensionsEnabled && (
            <>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 " />
                    <Label htmlFor="max-days" className="font-medium">
                      Maximum Extension Period (Days)
                    </Label>
                  </div>
                  <div className="flex items-center gap-4">
                    <Slider
                      id="max-days"
                      min={0}
                      max={ONE_YEAR}
                      step={30}
                      value={[maxDays]}
                      onValueChange={(value) => setMaxDays(value[0])}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={maxDays}
                      onChange={(e) => setMaxDays(Number(e.target.value))}
                      className="w-20"
                      min={1}
                      max={90}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 " />
                    <Label htmlFor="interest-rate" className="font-medium">
                      Extension Interest Rate (%)
                    </Label>
                  </div>
                  <div className="flex items-center gap-4">
                    <Slider
                      id="interest-rate"
                      min={0}
                      max={20}
                      step={0.5}
                      value={[interestRate]}
                      onValueChange={(value) => setInterestRate(value[0])}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={interestRate}
                      onChange={(e) => setInterestRate(Number(e.target.value))}
                      className="w-20"
                      min={0}
                      max={20}
                      step={0.5}
                    />
                  </div>
                  <p className="text-sm text-slate-500">
                    This rate will be applied on top of the base loan interest
                    rate
                  </p>
                </div>
              </div>

              <Alert variant="warning">
                <AlertCircle />
                <AlertTitle>Important</AlertTitle>
                <AlertDescription>
                  Setting high interest rates may discourage customers from
                  using extensions. Recommended range: 8-12%.
                </AlertDescription>
              </Alert>
            </>
          )}

          {saved && (
            <Alert variant="success">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>Settings saved successfully!</AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <CardFooter className="flex justify-end px-0 pt-6">
          <Button onClick={handleSubmit} disabled={saved}>
            {isLoading ? (
              <>
                <Loader className="animate-spin" />
                Please wait
              </>
            ) : (
              "Save Settings"
            )}
          </Button>
        </CardFooter>
      </CardContent>
    </Card>
  );
};

export default LoanExtensionManager;
