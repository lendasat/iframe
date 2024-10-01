import {
  CreateLoanOfferRequest,
  LoanAssetChain,
  LoanAssetType,
  useLenderHttpClient,
} from "@frontend-monorepo/http-client-lender";
import { Box, Grid, Heading } from "@radix-ui/themes";
import React, { useState } from "react";
import { Button, Col, Form, Row } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

export interface LoanDuration {
  min: number;
  max: number;
}

export interface LoanAmount {
  min: number;
  max: number;
}

export enum StableCoin {
  USDT_SN = "USDT_SN",
  USDC_SN = "USDC_SN",
  USDT_ETH = "USDT_ETH",
  USDC_ETH = "USDC_ETH",
}

function parseStableCoin(value: string): StableCoin | undefined {
  const normalizedValue = value.toUpperCase();

  for (const key in StableCoin) {
    if (StableCoin[key as keyof typeof StableCoin] === normalizedValue) {
      return StableCoin[key as keyof typeof StableCoin];
    }
  }

  return undefined;
}

const CreateLoanOffer: React.FC = () => {
  const layout = window;
  const [loanAmount, setLoanAmount] = useState<LoanAmount>({ min: 1000, max: 100000 });
  const [loanDuration, setLoanDuration] = useState<LoanDuration>({ min: 1, max: 12 });
  const [ltv, setLtv] = useState<number>(0.5);
  const [interest, setInterest] = useState<number>(0.12);
  const [selectedCoin, setSelectedCoin] = useState<StableCoin | undefined>(StableCoin.USDT_ETH);
  const [loanRepaymentAddress, setLoanRepaymentAddress] = useState<string>(
    "0xA0C68B2C3cC21F9376eB514c9f1bF80A4939e4A6",
  );
  const [error, setError] = useState("");

  const handleStableCoinChange = (coinString: string) => {
    const coin = parseStableCoin(coinString);
    setSelectedCoin(coin);
  };

  const mapToCreateLoanOfferSchema = (): CreateLoanOfferRequest => {
    let assetType = LoanAssetType.Usdt;
    let assetChain = LoanAssetChain.Starknet;
    switch (selectedCoin) {
      case StableCoin.USDT_SN:
        assetType = LoanAssetType.Usdt;
        assetChain = LoanAssetChain.Starknet;
        break;
      case StableCoin.USDC_SN:
        assetType = LoanAssetType.Usdc;
        assetChain = LoanAssetChain.Starknet;
        break;
      case StableCoin.USDT_ETH:
        assetType = LoanAssetType.Usdt;
        assetChain = LoanAssetChain.Ethereum;
        break;
      case StableCoin.USDC_ETH:
        assetType = LoanAssetType.Usdc;
        assetChain = LoanAssetChain.Ethereum;
        break;
    }

    return {
      name: "Loan Offer",
      min_ltv: ltv,
      interest_rate: interest,
      loan_amount_min: loanAmount.min,
      loan_amount_max: loanAmount.max,
      duration_months_min: loanDuration.min,
      duration_months_max: loanDuration.max,
      loan_asset_type: assetType,
      loan_asset_chain: assetChain,
      loan_repayment_address: loanRepaymentAddress,
    };
  };
  const navigate = useNavigate();
  const { postLoanOffer } = useLenderHttpClient();
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const data = mapToCreateLoanOfferSchema();

    try {
      const res = await postLoanOffer(data);
      console.log(res);
      if (res !== undefined) {
        navigate("/my-contracts");
      } else {
        console.error(res);
      }
    } catch (e) {
      console.error(e);
      setError(`Failed creating offer ${JSON.stringify(e)}`);
    }
  };

  return (
    <Form onSubmit={handleSubmit}>
      <Box
        style={{
          height: layout.innerHeight - 65
        }}>
        <Grid className="md:grid-cols-6 w-full">
          <Box
            className="px-6 md:px-8 pt-7 col-span-4 bg-gradient-to-br from-white/0 to-white border-r border-font/50"
            style={{
              minHeight: layout.innerHeight - 65
            }}
          >

            <Heading size={'7'}>
              Create an Offer
            </Heading>




            <Form.Group as={Row} controlId="formLoanAmount">
              <Form.Label column={true} sm="2">Loan Amount</Form.Label>
              <Col sm="5">
                <Form.Control
                  type="number"
                  placeholder="Min Amount"
                  value={loanAmount.min}
                  onChange={(e) => setLoanAmount({ ...loanAmount, min: Number(e.target.value) })}
                />
              </Col>
              <Col sm="5">
                <Form.Control
                  type="number"
                  placeholder="Max Amount"
                  value={loanAmount.max}
                  onChange={(e) => setLoanAmount({ ...loanAmount, max: Number(e.target.value) })}
                />
              </Col>
            </Form.Group>

            <Form.Group as={Row} controlId="formLoanDuration">
              <Form.Label column={true} sm="2">Loan Duration (Months)</Form.Label>
              <Col sm="5">
                <Form.Control
                  type="number"
                  placeholder="Min Duration"
                  value={loanDuration.min}
                  onChange={(e) => setLoanDuration({ ...loanDuration, min: Number(e.target.value) })}
                />
              </Col>
              <Col sm="5">
                <Form.Control
                  type="number"
                  placeholder="Max Duration"
                  value={loanDuration.max}
                  onChange={(e) => setLoanDuration({ ...loanDuration, max: Number(e.target.value) })}
                />
              </Col>
            </Form.Group>

            <Form.Group as={Row} controlId="formLtv">
              <Form.Label column={true} sm="2">Loan-to-Value (LTV) (0.0-0.9)</Form.Label>
              <Col sm="10">
                <Form.Control
                  type="number"
                  placeholder="LTV (0-1)"
                  value={ltv}
                  min={0}
                  max={0.9}
                  step={0.1}
                  onChange={(e) => setLtv(Number(e.target.value))}
                />
              </Col>
            </Form.Group>

            <Form.Group as={Row} controlId="formInterest">
              <Form.Label column={true} sm="2">Interest Rate (0.0-1.0)</Form.Label>
              <Col sm="10">
                <Form.Control
                  type="number"
                  placeholder="Interest Rate"
                  value={interest}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(e) => setInterest(Number(e.target.value))}
                />
              </Col>
            </Form.Group>

            <Form.Group as={Row} controlId="formStableCoins">
              <Form.Label column={true} sm="2">Stable Coins</Form.Label>
              <Col sm="10">
                {Object.keys(StableCoin).map((coin) => (
                  <Form.Check
                    inline
                    key={coin}
                    label={coin}
                    type="radio"
                    value={coin}
                    checked={selectedCoin === coin}
                    onChange={(e) => handleStableCoinChange(e.target.value)}
                  />
                ))}
              </Col>
            </Form.Group>

            <Form.Group as={Row} controlId="formLoanRepaymentAddress">
              <Form.Label column={true} sm="2">Loan Repayment Address</Form.Label>
              <Col sm="10">
                <Form.Control
                  type="text"
                  placeholder="Enter Repayment Address"
                  value={loanRepaymentAddress}
                  onChange={(e) => setLoanRepaymentAddress(e.target.value)}
                />
              </Col>
            </Form.Group>

            <Button variant="primary" type="submit">
              Submit
            </Button>
            {error && (
              <div
                className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mt-4"
                role="alert"
              >
                {error}
              </div>
            )}

          </Box>
        </Grid>
      </Box>
    </Form>
  );
};

export default CreateLoanOffer;
