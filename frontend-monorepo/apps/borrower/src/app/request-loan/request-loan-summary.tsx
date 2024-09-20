import { faInfoCircle, faWarning } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useWallet } from "@frontend-monorepo/borrower-wallet";
import { LoanOffer, useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import { formatCurrency, usePrice } from "@frontend-monorepo/ui-shared";
import React, { useState } from "react";
import { Alert, Badge, Button, Col, Container, Form, InputGroup, Row } from "react-bootstrap";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CreateWalletModal } from "../wallet/create-wallet-modal";
import { UnlockWalletModal } from "../wallet/unlock-wallet-modal";
import { Lender } from "./lender";
import { LoanFilter, LoanFilterType } from "./loan-offers-filter";
import { Slider, SliderProps } from "./slider";
import { StableCoin, StableCoinDropdown, StableCoinHelper } from "./stable-coin";

type LocationState = {
  loanOffer: LoanOffer;
  loanFilters?: LoanFilter[];
};

export function RequestLoanSummary() {
  const location = useLocation();
  const { loanOffer, loanFilters } = location.state as LocationState || {};
  const [error, setError] = useState("");

  const ORIGINATOR_FEE = 0.01;
  const { latestPrice } = usePrice();

  const { postContractRequest } = useBorrowerHttpClient();

  // Initialize filters
  const periodFilter = loanFilters.find((filter) => filter.type === LoanFilterType.PERIOD);
  const initMonths = periodFilter
    ? periodFilter.value > loanOffer?.duration.max ? loanOffer?.duration.max || 0 : periodFilter.value
    : loanOffer?.duration.max || 0;

  const amountFilter = loanFilters.find((filter) => filter.type === LoanFilterType.AMOUNT);
  const initAmount = amountFilter ? (amountFilter.value as number) : loanOffer?.amount.min || 0;

  const coinFilter = loanFilters.find((filter) => filter.type === LoanFilterType.STABLECOIN);
  const initCoin = coinFilter
    ? (coinFilter.value as StableCoin)
    : loanOffer.coins.length === 1
    ? loanOffer.coins[0]
    : undefined;

  const [loanAmount, setLoanAmount] = useState<number | undefined>(initAmount);
  const [selectedCoin, setSelectedCoin] = useState<StableCoin | undefined>(initCoin);

  const [loanAddress, setLoanAddress] = useState("");

  // Only for local testing
  let defaultBtcAddress = "";
  if (import.meta.env.VITE_BITCOIN_NETWORK === "regtest") {
    defaultBtcAddress = "bcrt1qqpf790lnsavxe9ree00tp8dd550ddw76pluxyr02tn2rssj6dtnstxmagd";
  }
  if (import.meta.env.VITE_BITCOIN_NETWORK === "signet") {
    defaultBtcAddress = "tb1q54wsjqzdm0fmqzezuzq00x9tramznhfa7zw6y0";
  }

  const [btcAddress, setBtcAddress] = useState(defaultBtcAddress);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [loanDuration, setLoanDuration] = useState<number>(initMonths);
  const [showCreateWalletModal, setShowCreateWalletModal] = useState(false);
  const [showUnlockWalletModal, setShowUnlockWalletModal] = useState(false);

  const collateral = loanAmount / (loanOffer.ltv / 100) / latestPrice;

  const loanOriginatorFee = (loanAmount / latestPrice) * ORIGINATOR_FEE;

  const handleLoanAmountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(event.target.value);
    setLoanAmount(value);

    // Validation
    if (isNaN(value)) {
      setAmountError("Amount is required");
    } else if (value < loanOffer.amount.min || value > loanOffer.amount.max) {
      setAmountError(
        `Amount must be between ${formatCurrency(loanOffer.amount.min)} and ${formatCurrency(loanOffer.amount.max)}`,
      );
    } else {
      setAmountError(null);
    }
  };

  const handleCloseCreateWalletModal = () => setShowCreateWalletModal(false);
  const handleOpenCreateWalletModal = () => setShowCreateWalletModal(true);

  const handleCloseUnlockWalletModal = () => setShowUnlockWalletModal(false);
  const handleOpenUnlockWalletModal = () => setShowUnlockWalletModal(true);

  const navigate = useNavigate();

  const { doesWalletExist, isWalletLoaded, getNextPublicKey } = useWallet();

  const handleRequestLoan = async () => {
    try {
      if (!doesWalletExist) {
        handleOpenCreateWalletModal();
        return;
      }
      if (!isWalletLoaded) {
        handleOpenUnlockWalletModal();
        return;
      }

      await requestLoan();
    } catch (error) {
      console.log(`Unexpected error happened ${error}`);
      setError(`${error}`);
    }
  };

  const requestLoan = async () => {
    try {
      const borrowerPk = getNextPublicKey();

      const res = await postContractRequest({
        loan_id: loanOffer.id,
        loan_amount: loanAmount || 0,
        duration_months: loanDuration,
        borrower_btc_address: btcAddress,
        borrower_pk: borrowerPk,
        borrower_loan_address: loanAddress,
      });

      if (res !== undefined) {
        navigate("/my-contracts");
      } else {
        // Handle error if needed
      }
    } catch (error) {
      console.log(`Unexpected error happened ${error}`);
      setError(`${error}`);
    }
  };

  const handleCoinSelect = (coin: StableCoin) => {
    setSelectedCoin(coin);
  };

  const periodSliderProps: SliderProps = {
    min: loanOffer.duration.min,
    max: loanOffer.duration.max,
    step: 1,
    init: loanDuration,
    suffix: " months",
    onChange: (duration) => {
      setLoanDuration(duration);
    },
  };

  const isButtonDisabled = loanAmount === undefined
    || loanAmount < loanOffer.amount.min
    || loanAmount > loanOffer.amount.max
    || amountError != null
    || !selectedCoin
    || !loanAddress.trim();

  const addressLabel = selectedCoin ? `${StableCoinHelper.print(selectedCoin)} address` : "Address";

  const handleSubmitCreateWalletModal = async () => {
    handleCloseCreateWalletModal();
  };
  const handleSubmitUnlockWalletModal = async () => {
    handleCloseUnlockWalletModal();
  };

  return (
    <Container className={"p-4"} fluid>
      <CreateWalletModal
        show={showCreateWalletModal}
        handleClose={handleCloseCreateWalletModal}
        handleSubmit={handleSubmitCreateWalletModal}
      />
      <UnlockWalletModal
        show={showUnlockWalletModal}
        handleClose={handleCloseUnlockWalletModal}
        handleSubmit={handleSubmitUnlockWalletModal}
      />
      <Row>
        <h3>
          Loan Parameters <Badge bg="primary">Draft</Badge>
        </h3>
      </Row>
      <Row className="mt-3">
        <Col xs={12} md={6}>
          <Form>
            <Form.Group className="mb-2" controlId="loan-amount">
              <Form.Label>
                <small>Loan amount</small>
              </Form.Label>
              <InputGroup>
                <Form.Control
                  type="number"
                  value={loanAmount !== undefined ? loanAmount : ""}
                  onChange={handleLoanAmountChange}
                  isInvalid={!!amountError}
                />
                <InputGroup.Text>$</InputGroup.Text>
              </InputGroup>
              {amountError ? <Form.Text className="text-danger">{amountError}</Form.Text> : ""}
            </Form.Group>
            <Form.Group className="mb-3" controlId="interest-slider">
              <Form.Label>
                <small>Period</small>
              </Form.Label>
              <Slider {...periodSliderProps} />
            </Form.Group>
            <Form.Group className="mb-3" controlId="stable-coin">
              <Form.Label>
                <small>Stable coin</small>
              </Form.Label>
              <StableCoinDropdown
                coins={loanOffer.coins}
                filter={false}
                defaultCoin={initCoin}
                onSelect={handleCoinSelect}
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="btc-address">
              <Form.Label>
                <small>Bitcoin refund address</small>
              </Form.Label>
              <Form.Control
                value={btcAddress}
                onChange={(e) => setBtcAddress(e.target.value)}
              />
            </Form.Group>
            <Alert className="mb-2" key="info" variant="warning">
              <FontAwesomeIcon icon={faInfoCircle} />{" "}
              Provide a valid address on the target network. Providing an incorrect address here will lead to loss of
              funds.
            </Alert>
            <Form.Group className="mb-3" controlId="stablecoin-address">
              <Form.Label>
                <small>{addressLabel}</small>
              </Form.Label>
              <Form.Control
                value={loanAddress}
                onChange={(e) => setLoanAddress(e.target.value)}
              />
            </Form.Group>
          </Form>
        </Col>
        <Col xs={12} md={6}>
          <Container fluid>
            <Row className="justify-content-between border-b mt-2">
              <Col>Lender</Col>
              <Col className="text-end mb-2">
                <Lender {...loanOffer.lender} />
              </Col>
            </Row>
            <Row className="justify-content-between border-b mt-2">
              <Col>Collateral</Col>
              <Col className="text-end mb-2">{collateral.toFixed(4)} BTC</Col>
            </Row>
            <Row className="justify-content-between border-b mt-2">
              <Col>LTV ratio</Col>
              <Col className="text-end mb-2">{loanOffer.ltv.toFixed(0)}%</Col>
            </Row>
            <Row className="justify-content-between border-b mt-2">
              <Col>Interest rate p.a.</Col>
              <Col className="text-end mb-2">{loanOffer.interest * 100}%</Col>
            </Row>
            <Row className="justify-content-between mt-2">
              <Col>Originator fee 1%</Col>
              <Col className="text-end">
                <Container className="p-0" fluid>
                  <Row className="text-end">
                    <Col>{loanOriginatorFee.toFixed(4)} BTC</Col>
                  </Row>
                  <Row>
                    <Col>
                      <small>~{formatCurrency(loanAmount * ORIGINATOR_FEE)}</small>
                    </Col>
                  </Row>
                </Container>
              </Col>
            </Row>
          </Container>
        </Col>
      </Row>
      <Row className={"mt-3"}>
        <Col className={"text-end"}>
          <Link to="/request-loan">
            <Button className={"btn-secondary"}>Cancel</Button>
          </Link>
          <span>{" "}</span>
          <Button onClick={handleRequestLoan} disabled={isButtonDisabled}>
            {doesWalletExist
              ? isWalletLoaded ? "Request" : "Load Wallet"
              : "Create Wallet"}
          </Button>
        </Col>
      </Row>
      {error
        ? (
          <Row>
            <Alert className="mb-2" key="info" variant="danger">
              <FontAwesomeIcon icon={faWarning} /> {error}
            </Alert>
          </Row>
        )
        : ""}
    </Container>
  );
}
