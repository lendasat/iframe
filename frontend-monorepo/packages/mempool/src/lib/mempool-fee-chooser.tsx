import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";
import { useFees } from "./mempool-fee";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@frontend/shadcn";

interface FeeButtonProps {
  onSelectFee: () => void;
  title: string;
  timeEstimate: string;
  description: string;
  isSelected: boolean;
}

const FeeButton = ({
  onSelectFee,
  isSelected,
  title,
  timeEstimate,
  description,
}: FeeButtonProps) => {
  return (
    <Card
      className={`cursor-pointer transition-all duration-200 hover:shadow-md hover:border-blue-400 ${
        isSelected
          ? "border-solid border-blue-500 bg-blue-50 dark:bg-blue-900/20"
          : "border-gray-200 dark:border-gray-700 hover:-translate-y-0.5"
      }`}
      onClick={onSelectFee}
    >
      <CardHeader>
        <CardTitle
          className={`text-sm ${isSelected ? "text-blue-600 dark:text-blue-400" : ""}`}
        >
          {title}
        </CardTitle>
        <CardDescription className={`text-xs`}>{timeEstimate}</CardDescription>
      </CardHeader>
      <CardContent className={`text-sm`}>{description}</CardContent>
    </Card>
  );
};

interface CustomFeeButtonProps {
  onSelectFee: () => void;
  onFeeChange: (event: ChangeEvent<HTMLInputElement>) => void;
  selectedFee: string;
  isSelected: boolean;
}

const CustomFeeButton = ({
  onSelectFee,
  selectedFee,
  isSelected,
  onFeeChange,
}: CustomFeeButtonProps) => {
  return (
    <Card
      className={`cursor-pointer transition-all duration-200 hover:shadow-md hover:border-blue-400 ${
        isSelected
          ? "border-solid border-blue-500 bg-blue-50 dark:bg-blue-900/20"
          : "border-gray-200 dark:border-gray-700 hover:-translate-y-0.5"
      }`}
      onClick={onSelectFee}
    >
      <CardHeader>
        <CardTitle
          className={isSelected ? "text-blue-600 dark:text-blue-400" : ""}
        >
          Custom
        </CardTitle>
        <CardDescription>Enter sats/vbyte</CardDescription>
      </CardHeader>
      <CardContent>
        <Input value={selectedFee} onChange={onFeeChange} />
      </CardContent>
    </Card>
  );
};

interface FeeSelectorProps {
  onSelectFee: (fee: number) => void;
}

export const FeeSelector = ({ onSelectFee }: FeeSelectorProps) => {
  const { recommendedFees, isLoading, refreshFees } = useFees();

  useEffect(() => {
    refreshFees();
  }, [refreshFees]);

  const [selectedFeeType, setSelectedFeeType] = useState<string>("fast");
  const [customFee, setCustomFee] = useState<string>("");

  const handleFeeSelection = (feeType: string) => {
    if (selectedFeeType === feeType) {
      // ignore reselection
      return;
    }
    setSelectedFeeType(feeType);
    if (feeType === "custom") {
      handleConfirm(feeType, parseInt(customFee));
    } else {
      handleConfirm(feeType);
    }
  };

  const handleCustomFeeChange = (event: ChangeEvent<HTMLInputElement>) => {
    setCustomFee(event.target.value);
    if (event.target.value.length === 0) {
      return;
    }
    const customRate = parseInt(event.target.value, 10);
    setSelectedFeeType("custom");
    handleConfirm("custom", customRate);
  };

  const handleConfirm = (feeType: string, customRate?: number) => {
    let fee = 0;
    if (feeType === "custom") {
      if (customRate == null) {
        throw new Error("Did not provide custom rate");
      }
      fee = customRate;
    } else if (recommendedFees) {
      switch (feeType) {
        case "fast":
          fee = recommendedFees.fastestFee;
          break;
        case "medium":
          fee = recommendedFees.hourFee;
          break;
        case "slow":
          fee = recommendedFees.economyFee;
          break;
      }
    }
    onSelectFee(fee);
  };

  return (
    <div>
      <h1 className="text-font dark:text-font-dark font-bold mb-2">
        Transaction Fee Rate
      </h1>
      {recommendedFees ? (
        <div className="grid grid-cols-3 gap-4">
          <FeeButton
            title={"Slow"}
            isSelected={selectedFeeType === "slow"}
            timeEstimate={"~1d"}
            description={`${recommendedFees.economyFee} sat/vB`}
            onSelectFee={() => handleFeeSelection("slow")}
          />
          <FeeButton
            title={"Medium"}
            isSelected={selectedFeeType === "medium"}
            timeEstimate={"~60m"}
            description={`${recommendedFees.hourFee} sat/vB`}
            onSelectFee={() => handleFeeSelection("medium")}
          />
          <FeeButton
            title={"Fast"}
            isSelected={selectedFeeType === "fast"}
            timeEstimate={"~10m"}
            description={`${recommendedFees.fastestFee} sat/vB`}
            onSelectFee={() => handleFeeSelection("fast")}
          />
          <div className="col-span-3">
            <CustomFeeButton
              isSelected={selectedFeeType === "custom"}
              onSelectFee={() => handleFeeSelection("custom")}
              onFeeChange={handleCustomFeeChange}
              selectedFee={customFee}
            />
          </div>
        </div>
      ) : (
        <p className="text-font dark:text-font-dark">
          Failed to load recommended fees. Please try again later.
        </p>
      )}
    </div>
  );
};

export default FeeSelector;
