import { cn, Input, Label, RadioGroup, RadioGroupItem } from "@frontend/shadcn";
import { type ChangeEvent, useEffect, useState } from "react";
import { useFees } from "./mempool-fee";
import { Clock } from "lucide-react";

interface BitcoinTransactionFeeSelectorProps {
  onSelectFee: (value: ((prevState: number) => number) | number) => void;
  selectedFee: number;
}

export const BitcoinTransactionFeeSelector = ({
  onSelectFee,
  selectedFee,
}: BitcoinTransactionFeeSelectorProps) => {
  const [error, setError] = useState(false);
  const [input, setInput] = useState(selectedFee);

  const { recommendedFees, refreshFees } = useFees();

  useEffect(() => {
    refreshFees();
    if (recommendedFees?.fastestFee) {
      onSelectFee(recommendedFees.fastestFee);
    }
  }, [refreshFees, recommendedFees, onSelectFee]);

  const [selectedFeeRate, setSelectedFeeRate] = useState<
    "fastest" | "hour" | "low" | "custom"
  >("fastest");

  const handleFeeRateChange = (
    value: "fastest" | "hour" | "low" | "custom",
  ) => {
    console.log(`handleFeeRateChange: ${value}`);
    setSelectedFeeRate(value);
    switch (value) {
      case "hour":
        onSelectFee(recommendedFees?.hourFee || 1);
        break;
      case "fastest":
        onSelectFee(recommendedFees?.fastestFee || 1);
        break;
      case "low":
        onSelectFee(recommendedFees?.economyFee || 1);
        break;
      case "custom":
        setInput(selectedFee);
        break;
    }
    setError(false);
  };

  const onFeeRateInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    const string = e.target.value;
    const number = Number.parseInt(string);
    setInput(number);
    onSelectFee(number);
  };

  return (
    <div className="space-y-3">
      <Label>Transaction Fee Rate</Label>
      <RadioGroup
        value={selectedFeeRate}
        onValueChange={handleFeeRateChange}
        className="grid grid-cols-3 gap-2"
      >
        <div className="relative">
          <RadioGroupItem
            id={"minimal"}
            value={"low"}
            className="sr-only peer"
          />
          <label
            htmlFor={`minimal`}
            className={cn(
              "flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer h-28",
            )}
          >
            <div className="flex flex-col items-center text-center h-full justify-center">
              <Clock className="mb-2 h-5 w-5 hidden md:block" />
              <div className="text-md font-medium">Low</div>
              <div className="text-xs mt-1">
                {recommendedFees?.economyFee} s/vb (~24h)
              </div>
            </div>
          </label>
        </div>
        <div className="relative">
          <RadioGroupItem id={"hour"} value={"hour"} className="sr-only peer" />
          <label
            htmlFor={`hour`}
            className={cn(
              "flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer h-28",
            )}
          >
            <div className="flex flex-col items-center text-center h-full justify-center">
              <Clock className="mb-2 h-5 w-5 hidden md:block" />
              <div className="text-md font-medium">Medium</div>
              <div className="text-xs mt-1">
                {recommendedFees?.hourFee} s/vb (~1h)
              </div>
            </div>
          </label>
        </div>
        <div className="relative">
          <RadioGroupItem
            id={"fastest"}
            value={"fastest"}
            className="sr-only peer"
          />
          <label
            htmlFor={`fastest`}
            className={cn(
              "flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer h-28",
            )}
          >
            <div className="flex flex-col items-center text-center h-full justify-center">
              <Clock className="mb-2 h-5 w-5 hidden md:block" />
              <div className="text-md font-medium">Next Block</div>
              <div className="text-xs mt-1">
                {recommendedFees?.fastestFee} s/vb (~10m)
              </div>
            </div>
          </label>
        </div>
      </RadioGroup>

      <div className="mt-4">
        <RadioGroup value={selectedFeeRate} onValueChange={handleFeeRateChange}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="custom" id="fee-custom" />
            <Label htmlFor="fee-custom" className="font-medium">
              Custom
            </Label>
          </div>
        </RadioGroup>

        {selectedFeeRate === "custom" && (
          <div className="mt-2">
            <Input
              type="number"
              placeholder="Enter sats/vByte"
              value={input}
              onChange={(e) => onFeeRateInputChange(e)}
              min="1"
              data-1p-ignore
              autoComplete={"off"}
              className={`font-mono ${error ? "border-destructive" : ""}`}
            />
            {error && (
              <p className="text-sm text-destructive mt-1">
                Please enter a custom fee rate
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
