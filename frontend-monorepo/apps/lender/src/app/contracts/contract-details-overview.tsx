import { faExclamationCircle, faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Contract, ContractStatus, contractStatusToLabelString } from "@frontend-monorepo/http-client-lender";
import { useLenderHttpClient } from "@frontend-monorepo/http-client-lender";
import { LiquidationStatus } from "@frontend-monorepo/http-client-lender";
import { CurrencyFormatter } from "@frontend-monorepo/ui-shared";
import React, { Suspense, useState } from "react";
import { Alert, Badge, Button, Col, Container, OverlayTrigger, Row, Spinner, Tooltip } from "react-bootstrap";
import { Await, useNavigate, useParams } from "react-router-dom";
import { ExpandableDisputeCard } from "../disputes/dispute-card";
import RepaymentDetails from "./pay-loan-principal";

function ContractDetailsOverview() {
  const { getContract } = useLenderHttpClient();
  const { id } = useParams();

  return (
    <Suspense>
      <Await
        resolve={getContract(id!)}
        errorElement={<div>Could not load contracts</div>}
        children={(contract: Awaited<Contract>) => (
          <Container className={"p-4"} fluid>
            <Details contract={contract} />
          </Container>
        )}
      />
    </Suspense>
  );
}

export default ContractDetailsOverview;

interface DetailsProps {
  contract: Contract;
}

function Details({ contract }: DetailsProps) {
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const onSuccess = () => {
    navigate(0);
  };

  return (
    <Row className="mt-3">
      <Col xs={12} md={6}>
        {<ContractDetails contract={contract} />}
      </Col>
      <Col xs={12} md={6}>
        <ContractStatusDetails
          contract={contract}
          onError={setError}
          onSuccess={onSuccess}
        />
        {error && (
          <Alert variant="danger">
            <FontAwesomeIcon icon={faExclamationCircle} className="h-4 w-4 mr-2" />
            {error}
          </Alert>
        )}
      </Col>
    </Row>
  );
}

interface DetailsProps {
  contract: Contract;
}

function ContractDetails({ contract }: DetailsProps) {
  const { startDispute } = useLenderHttpClient();

  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [startingDisputeLoading, setStartingDisputeLoading] = useState(false);

  const collateral_sats = contract.initial_collateral_sats;
  const collateral = collateral_sats / 100000000;
  const loanAmount = contract.loan_amount;
  const durationMonths = contract.duration_months;

  const interestRate = contract.interest_rate;

  const initialLtv = contract.initial_ltv;
  const initial_price = loanAmount / (collateral * initialLtv);

  const initialLtvFormatted = (initialLtv * 100).toFixed(0);

  const disputeInProgress = contract.status === ContractStatus.DisputeBorrowerResolved
    || contract.status === ContractStatus.DisputeLenderResolved
    || contract.status === ContractStatus.DisputeBorrowerStarted
    || contract.status === ContractStatus.DisputeLenderStarted;

  const loanOriginatorFee = contract.origination_fee_sats / 100000000;
  const loanOriginatorFeeUsd = (loanOriginatorFee * initial_price).toFixed(0);

  const onStartDispute = async (reason: string, comment: string) => {
    setStartingDisputeLoading(true);
    try {
      await startDispute(contract.id, reason, comment);
      setInfo("A new dispute was started, please check your email");
      setError("");
    } catch (error) {
      setInfo("");
      setError(`${error}`);
    } finally {
      setStartingDisputeLoading(false);
    }
  };

  let contractStatusLabel = contractStatusToLabelString(contract.status);
  const firstMarginCall = contract.liquidation_status === LiquidationStatus.FirstMarginCall;
  const secondMarginCall = contract.liquidation_status === LiquidationStatus.SecondMarginCall;
  const liquidated = contract.liquidation_status === LiquidationStatus.Liquidated;

  if (firstMarginCall) {
    contractStatusLabel = "First Margin Call";
  }
  if (secondMarginCall) {
    contractStatusLabel = "Second Margin Call";
  }
  if (liquidated) {
    contractStatusLabel = "Liquidated";
  }

  return (
    <Container fluid>
      <Row>
        <h4>Contract Details</h4>
      </Row>
      <Row className="justify-content-between border-b mt-2">
        <Col>id</Col>
        <Col className="text-end mb-2">
          {contract.id}
        </Col>
      </Row>
      <Row className="justify-content-between border-b mt-2">
        <Col>Borrower</Col>
        <Col className="text-end mb-2">
          {contract.borrower_pk}
        </Col>
      </Row>
      <Row className="justify-content-between border-b mt-2">
        <Col>Contract status</Col>
        <Col className="text-end mb-2">
          <Badge bg="primary">{contractStatusLabel}</Badge>
        </Col>
      </Row>
      <Row className="justify-content-between border-b mt-2">
        <Col md={6}>Loan amount</Col>
        <Col md={6} className="text-end mb-2">
          <CurrencyFormatter value={loanAmount} />
        </Col>
      </Row>
      <Row className="justify-content-between border-b mt-2">
        <Col md={6}>Duration</Col>
        <Col md={6} className="text-end mb-2">
          {durationMonths} months
        </Col>
      </Row>
      <Row className="justify-content-between border-b mt-2">
        <Col>Collateral</Col>
        <Col className="text-end mb-2">
          {collateral.toFixed(8)} BTC
        </Col>
      </Row>
      <Row className="justify-content-between border-b mt-2">
        <Col md={6}>Origination fee (1%)</Col>
        <Col md={6} className="text-end mb-2">
          <OverlayTrigger
            placement="top"
            overlay={<Tooltip>${loanOriginatorFeeUsd}</Tooltip>}
          >
            <span>{loanOriginatorFee.toFixed(8)} BTC</span>
          </OverlayTrigger>
        </Col>
      </Row>
      <Row className="justify-content-between border-b mt-2">
        <Col>LTV ratio</Col>
        <Col className="text-end mb-2">{initialLtvFormatted}%</Col>
      </Row>
      <Row className="justify-content-between mt-2">
        <Col>Interest rate p.a.</Col>
        <Col className="text-end mb-2">
          {interestRate * 100}%
        </Col>
      </Row>
      <Row className="justify-content-between mt-5">
        <AdditionalDetail contract={contract} />
      </Row>
      <Row>
        <ExpandableDisputeCard
          info={info}
          onStartDispute={onStartDispute}
          startingDisputeLoading={startingDisputeLoading}
          error={error}
          disputeInProgress={disputeInProgress}
        />
      </Row>
    </Container>
  );
}

interface AdditionalDetailsProps {
  contract: Contract;
}

const AdditionalDetail = ({ contract }: AdditionalDetailsProps) => {
  switch (contract.status) {
    case ContractStatus.Requested:
      break;
    case ContractStatus.Approved:
      break;
    case ContractStatus.CollateralSeen:
    case ContractStatus.CollateralConfirmed:
      return (
        <Row className="justify-content-between border-b mt-2">
          <Col>Funding transaction</Col>
          <Col className="text-end mb-2">
            TODO!
          </Col>
        </Row>
      );
    case ContractStatus.PrincipalGiven:
      return (
        <>
          <Row className="justify-content-between border-b mt-2">
            <Col>Funding transaction</Col>
            <Col className="text-end mb-2">
              TODO!
            </Col>
          </Row>
          <Row className="justify-content-between border-b mt-2">
            <Col>Principal transaction</Col>
            <Col className="text-end mb-2">
              TODO!
            </Col>
          </Row>
        </>
      );
    case ContractStatus.Repaid:
      return (
        <>
          <Row className="justify-content-between border-b mt-2">
            <Col>Funding transaction</Col>
            <Col className="text-end mb-2">
              TODO!
            </Col>
          </Row>
          <Row className="justify-content-between border-b mt-2">
            <Col>Principal transaction</Col>
            <Col className="text-end mb-2">
              TODO!
            </Col>
          </Row>
          <Row className="justify-content-between border-b mt-2">
            <Col>Principal repayment transaction</Col>
            <Col className="text-end mb-2">
              TODO!
            </Col>
          </Row>
        </>
      );
    case ContractStatus.Closing:
    case ContractStatus.Closed:
      return (
        <>
          <Row className="justify-content-between border-b mt-2">
            <Col>Funding transaction</Col>
            <Col className="text-end mb-2">
              TODO!
            </Col>
          </Row>
          <Row className="justify-content-between border-b mt-2">
            <Col>Principal transaction</Col>
            <Col className="text-end mb-2">
              TODO!
            </Col>
          </Row>
          <Row className="justify-content-between border-b mt-2">
            <Col>Principal repayment transaction</Col>
            <Col className="text-end mb-2">
              TODO!
            </Col>
          </Row>
          <Row className="justify-content-between mt-2">
            <Col>Collateral claim transaction</Col>
            <Col className="text-end mb-2">
              TODO!
            </Col>
          </Row>
        </>
      );
    case ContractStatus.Rejected:
      // TODO
      return "";
  }
};

interface ContractStatusDetailsProps {
  contract: Contract;
  onError: (error: string) => void;
  onSuccess: () => void;
}

const ContractStatusDetails = (
  {
    contract,
    onError,
    onSuccess,
  }: ContractStatusDetailsProps,
) => {
  const { approveContract, rejectContract, principalGiven, markAsRepaid } = useLenderHttpClient();
  const [isLoading, setIsLoading] = useState(false);
  const [txid, setTxid] = useState("");

  const onContractApprove = async () => {
    try {
      setIsLoading(true);
      await approveContract(contract.id);
      onSuccess();
    } catch (error) {
      onError(`${error}`);
    } finally {
      setIsLoading(false);
    }
  };
  const onContractReject = async () => {
    try {
      setIsLoading(true);
      await rejectContract(contract.id);
      onSuccess();
    } catch (error) {
      onError(`${error}`);
    } finally {
      setIsLoading(false);
    }
  };
  const onPrincipalGiven = async () => {
    try {
      setIsLoading(true);
      await principalGiven(contract.id, txid);
      onSuccess();
    } catch (error) {
      onError(`${error}`);
    } finally {
      setIsLoading(false);
    }
  };
  const onMarkAsRepaid = async () => {
    try {
      setIsLoading(true);
      await markAsRepaid(contract.id, txid);
      onSuccess();
    } catch (error) {
      onError(`${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  switch (contract.status) {
    case ContractStatus.Requested:
      // TODO:
      return (
        <div className="d-flex gap-2">
          <Button onClick={onContractApprove} disabled={isLoading}>
            {isLoading
              ? (
                <Spinner animation="border" role="status" variant="light" size="sm">
                  <span className="visually-hidden">Loading...</span>
                </Spinner>
              )
              : "Approve"}
          </Button>
          <Button onClick={onContractReject} disabled={isLoading}>
            {isLoading
              ? (
                <Spinner animation="border" role="status" variant="light" size="sm">
                  <span className="visually-hidden">Loading...</span>
                </Spinner>
              )
              : "Reject"}
          </Button>
        </div>
      );
    case ContractStatus.Approved:
      return (
        <Alert variant="info">
          <FontAwesomeIcon icon={faInfoCircle} className="h-4 w-4 mr-2" />
          Waiting for user to fund the contract. Please refresh to check for updates.
        </Alert>
      );
    case ContractStatus.CollateralSeen:
    case ContractStatus.CollateralConfirmed:
      return (
        <div>
          <label htmlFor="txid">Transaction ID:</label>
          <input
            id="txid"
            type="text"
            value={txid}
            onChange={(e) => setTxid(e.target.value)}
            placeholder="Enter transaction ID"
          />

          <RepaymentDetails contract={contract} isLoading={isLoading} onPrincipalGiven={onPrincipalGiven} />
        </div>
      );
    case ContractStatus.PrincipalGiven:
      return (
        <div>
          {/* Text input for txid */}
          <label htmlFor="txid">Transaction ID:</label>
          <input
            id="txid"
            type="text"
            value={txid}
            onChange={(e) => setTxid(e.target.value)}
            placeholder="Enter transaction ID"
          />

          <Button onClick={onMarkAsRepaid} disabled={isLoading}>
            {isLoading
              ? (
                <Spinner animation="border" role="status" variant="light" size="sm">
                  <span className="visually-hidden">Loading...</span>
                </Spinner>
              )
              : "Mark as repaid"}
          </Button>
        </div>
      );
    case ContractStatus.Repaid:
      return (
        <Alert variant="info">
          <FontAwesomeIcon icon={faInfoCircle} className="h-4 w-4 mr-2" />
          Waiting for user to withdraw funds.
        </Alert>
      );
    case ContractStatus.Closed:
    case ContractStatus.Closing:
    case ContractStatus.Rejected:
    default:
      return "";
  }
};
