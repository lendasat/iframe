import React, { useEffect, useState } from "react";
import { Button, ButtonGroup, Form, Row, Spinner } from "react-bootstrap";
import type { RecommendedFees } from "./mempool-client";
import MempoolClient from "./mempool-client";

interface FeeSelectorProps {
  onSelectFee: (fee: number) => void;
}

export const FeeSelector = ({ onSelectFee }: FeeSelectorProps) => {
  const [recommendedFees, setRecommendedFees] = useState<RecommendedFees>({
    economyFee: 1,
    fastestFee: 1,
    halfHourFee: 1,
    hourFee: 1,
    minimumFee: 1,
  });
  const [selectedFeeType, setSelectedFeeType] = useState<string>("fast");
  const [customFee, setCustomFee] = useState<string>("1");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFees = async () => {
      const client = new MempoolClient(import.meta.env.VITE_MEMPOOL_REST_URL);
      try {
        const fees = await client.getRecommendedFees();
        setRecommendedFees(fees);

        onSelectFee(fees.fastestFee);
      } catch (error) {
        console.error("Error fetching recommended fees:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFees();
  }, [onSelectFee]);

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

  const handleCustomFeeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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
      <h1>Select Fee Rate</h1>
      {recommendedFees
        ? (
          <Form>
            <ButtonGroup className="d-flex justify-content-between">
              <Button
                variant={selectedFeeType === "fast" ? "primary" : "outline-primary"}
                onClick={() => handleFeeSelection("fast")}
              >
                <Row>
                  <p>Fast (~10m)</p>
                  <p>({recommendedFees.fastestFee} sat/vB)</p>
                </Row>
              </Button>
              <Button
                variant={selectedFeeType === "medium" ? "primary" : "outline-primary"}
                onClick={() => handleFeeSelection("medium")}
              >
                <Row>
                  <p>Medium (~60m)</p>
                  <p>({recommendedFees.hourFee} sat/vB)</p>
                </Row>
              </Button>
              <Button
                variant={selectedFeeType === "slow" ? "primary" : "outline-primary"}
                onClick={() => handleFeeSelection("slow")}
              >
                <Row>
                  <p>Slow (~1d)</p>
                  <p>({recommendedFees.economyFee} sat/vB)</p>
                </Row>
              </Button>
              <Button
                variant={selectedFeeType === "custom" ? "primary" : "outline-primary"}
                onClick={() => handleFeeSelection("custom")}
              >
                <p>Custom</p>
                <Form.Group className="mt-3">
                  <Form.Control
                    type="number"
                    placeholder="Enter custom fee (sat/vB)"
                    value={customFee}
                    onChange={handleCustomFeeChange}
                  />
                </Form.Group>
              </Button>
            </ButtonGroup>
          </Form>
        )
        : <p>Failed to load recommended fees. Please try again later.</p>}
    </div>
  );
};

export default FeeSelector;
