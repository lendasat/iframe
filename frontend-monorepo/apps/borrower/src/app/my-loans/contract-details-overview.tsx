import { faExclamationCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  Contract,
  ContractStatus,
  contractStatusToLabelString,
  LiquidationStatus,
  useAuth,
  useBorrowerHttpClient,
} from "@frontend-monorepo/http-client-borrower";
import { CurrencyFormatter, usePrice } from "@frontend-monorepo/ui-shared";
import { Suspense, useState } from "react";
import { Alert, Badge, Button, Col, Container, OverlayTrigger, Row, Tooltip } from "react-bootstrap";
import { Await, useParams } from "react-router-dom";
import { Lender } from "../request-loan/lender";
import { AddCollateralModal } from "./add-collateral-modal";
import { collateralForStatus } from "./collateralForStatus";
import { CollateralContractDetails } from "./collateralize-contract";
import { CollateralSeenOrConfirmed } from "./contract-collateral-seen-or-confirmed";
import { ContractPrincipalGiven } from "./contract-principal-given";
import { ContractRepaid } from "./contract-repaid";
import { ContractRequested } from "./contract-requested";
import { ExpandableDisputeCard } from "./dispute-card";
import { downloadLocalStorage } from "./download-local-storage";

function ContractDetailsOverview() {
  const { getContract } = useBorrowerHttpClient();
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
  const collateralSats = collateralForStatus(
    contract.status,
    contract.initial_collateral_sats,
    contract.collateral_sats,
  );
  const collateralBtc = collateralSats / 100000000;

  const loanAmount = contract.loan_amount;
  const contractAddress = contract.contract_address;

  const originationFeeBtc = contract.origination_fee_sats / 100000000;
  const totalCollateral = (collateralBtc + originationFeeBtc).toFixed(8);

  const accruedInterest = contract.loan_amount * ((contract.interest_rate / 12) * contract.duration_months);
  const totalRepaymentAmount = accruedInterest + loanAmount;

  // TODO: Let's calculate the initial price once, in the backend.
  const initialCollateralBtc = contract.initial_collateral_sats / 100000000;
  const initialPrice = loanAmount / (initialCollateralBtc * contract.initial_ltv);
  const loanOriginatorFeeUsd = (originationFeeBtc * initialPrice).toFixed(0);

  return (
    <Row className="mt-3">
      <Col xs={12} md={6}>
        {<ContractDetails contract={contract} />}
      </Col>
      <Col xs={12} md={6}>
        <ContractStatusDetails
          contract={contract}
          collateralBtc={collateralBtc}
          contractAddress={contractAddress || ""}
          totalCollateral={totalCollateral}
          totalRepaymentAmount={totalRepaymentAmount}
          loanOriginatorFee={originationFeeBtc}
          loanOriginatorFeeUsd={loanOriginatorFeeUsd}
        />
      </Col>
    </Row>
  );
}

interface DetailsProps {
  contract: Contract;
}

function ContractDetails({ contract }: DetailsProps) {
  const { latestPrice } = usePrice();
  const [startingDisputeLoading, setStartingDisputeLoading] = useState(false);
  const { backendVersion } = useAuth();

  const [showAddCollateralModal, setShowAddCollateralModal] = useState(false);

  const [error, setError] = useState("");

  const { startDispute } = useBorrowerHttpClient();

  const collateral = collateralForStatus(contract.status, contract.initial_collateral_sats, contract.collateral_sats);
  const collateralBtc = collateral / 100000000;
  const loanAmount = contract.loan_amount;
  const interestRate = contract.interest_rate;
  const durationMonths = contract.duration_months;

  const initialLtv = contract.initial_ltv;
  const initial_price = loanAmount / (collateral * initialLtv);

  const ltvRatio = loanAmount / (collateralBtc * latestPrice);
  const ltvPercentage = (ltvRatio * 100).toFixed(0);

  const loanOriginatorFee = contract.origination_fee_sats / 100000000;
  const loanOriginatorFeeUsd = (loanOriginatorFee * initial_price).toFixed(0);

  const disputeInProgress = contract.status === ContractStatus.DisputeBorrowerResolved
    || contract.status === ContractStatus.DisputeLenderResolved
    || contract.status === ContractStatus.DisputeBorrowerStarted
    || contract.status === ContractStatus.DisputeLenderStarted;

  const [info, setInfo] = useState("");

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

  const firstMarginCall = contract.liquidation_status == LiquidationStatus.FirstMarginCall;
  const secondMarginCall = contract.liquidation_status == LiquidationStatus.SecondMarginCall;
  const liquidated = contract.liquidation_status == LiquidationStatus.Liquidated;

  let contractStatusLabel = contractStatusToLabelString(contract.status);
  if (firstMarginCall) {
    contractStatusLabel = "First Margin Call";
  }
  if (secondMarginCall) {
    contractStatusLabel = "Second Margin Call";
  }
  if (liquidated) {
    contractStatusLabel = "Liquidated";
  }

  const handleCloseAddCollateralModal = () => setShowAddCollateralModal(false);
  const handleOpenAddCollateralModal = () => setShowAddCollateralModal(true);

  let canAddExtraCollateral;
  switch (contract.status) {
    case ContractStatus.Requested:
    case ContractStatus.Approved:
    case ContractStatus.Rejected:
    case ContractStatus.Repaid:
    case ContractStatus.Closing:
    case ContractStatus.Closed:
      canAddExtraCollateral = false;
      break;
    case ContractStatus.CollateralSeen:
    case ContractStatus.CollateralConfirmed:
    case ContractStatus.PrincipalGiven:
    case ContractStatus.DisputeBorrowerStarted:
    case ContractStatus.DisputeLenderStarted:
    case ContractStatus.DisputeBorrowerResolved:
    case ContractStatus.DisputeLenderResolved:
      canAddExtraCollateral = true;
      break;
  }

  return (
    <Container fluid>
      <AddCollateralModal
        show={showAddCollateralModal}
        address={contract.contract_address!}
        handleClose={handleCloseAddCollateralModal}
      />
      <Row className="mb-2">
        <h4>Contract Details</h4>
      </Row>
      <Alert variant={"info"} className="d-flex align-items-center">
        <div className="d-flex align-items-center">
          <FontAwesomeIcon icon={faExclamationCircle} className="h-4 w-4 mr-2" />
          Download contract backup. It is encrypted with the contract password you set earlier.
        </div>
        <Button onClick={() => downloadLocalStorage(backendVersion)}>Download</Button>
      </Alert>
      <Row className="justify-content-between border-b mt-2">
        <Col>Lender</Col>
        <Col className="text-end mb-2">
          <Lender {...contract.lender} />
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
        <Col md={6}>Loan duration</Col>
        <Col md={6} className="text-end mb-2">
          {durationMonths} months
        </Col>
      </Row>
      <Row className="justify-content-between border-b mt-2">
        <Col>
          Collateral
          {canAddExtraCollateral && (
            <Button onClick={handleOpenAddCollateralModal} size="sm" className="ml-2">
              +
            </Button>
          )}
        </Col>
        <Col className="text-end mb-2">
          {collateralBtc.toFixed(8)} BTC
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
        <Col className="text-end mb-2">{ltvPercentage}%</Col>
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

      <ExpandableDisputeCard
        info={info}
        onStartDispute={onStartDispute}
        startingDisputeLoading={startingDisputeLoading}
        error={error}
        disputeInProgress={disputeInProgress}
      />
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
  collateralBtc: number;
  totalCollateral: string;
  contractAddress: string;
  totalRepaymentAmount: number;
  loanOriginatorFee: number;
  loanOriginatorFeeUsd: string;
}

const ContractStatusDetails = (
  {
    contract,
    collateralBtc,
    totalCollateral,
    contractAddress,
    totalRepaymentAmount,
    loanOriginatorFee,
    loanOriginatorFeeUsd,
  }: ContractStatusDetailsProps,
) => {
  switch (contract.status) {
    case ContractStatus.Requested:
      return <ContractRequested createdAt={contract.created_at} />;
    case ContractStatus.Approved:
      return (
        <CollateralContractDetails
          totalCollateral={totalCollateral}
          collateralAddress={contractAddress}
          collateral_btc={contract.initial_collateral_sats / 100000000}
          loanOriginatorFeeUsd={loanOriginatorFeeUsd}
          loanOriginatorFee={loanOriginatorFee}
        />
      );
    case ContractStatus.CollateralSeen:
    case ContractStatus.CollateralConfirmed:
      return (
        <CollateralSeenOrConfirmed
          collateral={totalCollateral}
          collateralAddress={contractAddress}
          contract={contract}
        />
      );
    case ContractStatus.PrincipalGiven:
      return (
        <ContractPrincipalGiven
          repaymentAddress={contract.loan_repayment_address}
          totalRepaymentAmount={totalRepaymentAmount}
        />
      );
    case ContractStatus.Repaid:
      return <ContractRepaid contract={contract} collateralBtc={collateralBtc} />;
    case ContractStatus.Closed:
    case ContractStatus.Closing:
    case ContractStatus.Rejected:
    default:
      return "";
  }
};
