import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";
import { Button, ButtonGroup, Form, Row, Spinner } from "react-bootstrap";
import { useFees } from "./mempool-fee";

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

  if (isLoading) {
    return (
      <Spinner animation="border" role="status">
        <span className="visually-hidden">Loading...</span>
      </Spinner>
    );
  }

  return (
    <div>
      <h1 className={"text-font dark:text-font-dark font-bold"}>
        Transaction Fee Rate
      </h1>
      {recommendedFees ? (
        <ButtonGroup className="d-flex justify-content-between">
          <Button
            variant={
              selectedFeeType === "slow"
                ? "primary dark:bg-dark-700 dark:border-dark"
                : "outline-primary dark:bg-dark dark:border-dark dark:hover:bg-dark-600"
            }
            onClick={() => handleFeeSelection("slow")}
          >
            <Row className={"dark:text-font-dark"}>
              <p>Slow (~1d)</p>
              <p>{recommendedFees.economyFee} sat/vB</p>
            </Row>
          </Button>
          <Button
            variant={
              selectedFeeType === "medium"
                ? "primary dark:bg-dark-700 dark:border-dark"
                : "outline-primary dark:bg-dark dark:border-dark dark:hover:bg-dark-600"
            }
            onClick={() => handleFeeSelection("medium")}
          >
            <Row className={"dark:text-font-dark"}>
              <p>Medium (~60m)</p>
              <p>{recommendedFees.hourFee} sat/vB</p>
            </Row>
          </Button>
          <Button
            variant={
              selectedFeeType === "fast"
                ? "primary dark:bg-dark-700 dark:border-dark"
                : "outline-primary dark:bg-dark dark:border-dark dark:hover:bg-dark-600"
            }
            onClick={() => handleFeeSelection("fast")}
          >
            <Row className={"dark:text-font-dark"}>
              <p>Fast (~10m)</p>
              <p>{recommendedFees.fastestFee} sat/vB</p>
            </Row>
          </Button>

          <Button
            variant={
              selectedFeeType === "custom"
                ? "primary dark:bg-dark-700 dark:border-dark"
                : "outline-primary dark:bg-dark dark:border-dark dark:hover:bg-dark-600"
            }
            onClick={() => handleFeeSelection("custom")}
          >
            <p className={"dark:text-font-dark"}>Custom</p>
            <Form.Group className="mt-3">
              <Form.Control
                type="number"
                placeholder="Enter custom fee (sat/vB)"
                value={customFee}
                className={
                  "dark:bg-dark dark:text-font-dark dark:placeholder:text-font-dark/60"
                }
                onChange={handleCustomFeeChange}
              />
            </Form.Group>
          </Button>
        </ButtonGroup>
      ) : (
        <p className={"text-font dark:text-font-dark"}>
          Failed to load recommended fees. Please try again later.
        </p>
      )}
    </div>
  );
};

export default FeeSelector;
