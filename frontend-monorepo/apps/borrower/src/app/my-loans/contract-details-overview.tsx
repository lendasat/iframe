import { faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Contract, ContractStatus, contractStatusToLabelString, useAuth } from "@frontend-monorepo/http-client";
import React, { Suspense } from "react";
import { Alert, Badge, Col, Container, Form, InputGroup, OverlayTrigger, Row, Tooltip } from "react-bootstrap";
import { Await, useParams } from "react-router-dom";
import { Lender } from "../request-loan/lender";
import Usd from "../usd";
import { CollateralContractDetails } from "./collateralize-contract";
import { CollateralSeenOrConfirmed } from "./contract-collateral-seen-or-confirmed";
import { ContractPrincipalGiven } from "./contract-principal-given";
import { ContractRepaid } from "./contract-repaid";
import { ContractRequested } from "./contract-requested";

function ContractDetailsOverview() {
  const { getContract } = useAuth();
  const { id } = useParams();

  return (
    <Suspense>
      <Await
        resolve={getContract(id)}
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
  // TODO: this should come from the backend
  const ORIGINATOR_FEE = 0.01;

  const collateral_sats = contract.collateral_sats;
  const collateral = collateral_sats / 100000000;
  const loanAmount = contract.loan_amount;
  const contractAddress = contract.contract_address;

  const initialLtv = contract.initial_ltv;
  const initial_price = loanAmount / (collateral * initialLtv);

  // FIXME: Let's do this once, in the backend.
  const loanOriginatorFee = (loanAmount / initial_price) * ORIGINATOR_FEE;
  const totalCollateral = (collateral + loanOriginatorFee).toFixed(8);

  const accruedInterest = contract.loan_amount * (contract.interest_rate / 100);
  const totalRepaymentAmount = accruedInterest + loanAmount;

  return (
    <Row className="mt-3">
      <Col xs={12} md={6}>
        {<ContractDetails contract={contract} />}
      </Col>
      <Col xs={12} md={6}>
        <ContractStatusDetails
          contract={contract}
          contractAddress={contractAddress || ""}
          totalCollateral={totalCollateral}
          totalRepaymentAmount={totalRepaymentAmount}
        />
      </Col>
    </Row>
  );
}

interface DetailsProps {
  contract: Contract;
}
function ContractDetails({ contract }: DetailsProps) {
  const ORIGINATOR_FEE = 0.01;

  const collateral_sats = contract.collateral_sats;
  const collateral = collateral_sats / 100000000;
  const loanAmount = contract.loan_amount;
  const interestRate = contract.interest_rate;

  const initialLtv = contract.initial_ltv;
  const initial_price = loanAmount / (collateral * initialLtv);
  const initialLtvFormatted = initialLtv.toFixed(0);

  // FIXME: Let's do this once, in the backend.
  const loanOriginatorFee = (loanAmount / initial_price) * ORIGINATOR_FEE;
  const totalCollateral = (collateral + loanOriginatorFee).toFixed(8);
  const loanOriginatorFeeUsd = (loanOriginatorFee * initial_price).toFixed(0);

  return (
    <Container fluid>
      <Row>
        <h4>Contract Details</h4>
      </Row>
      <Row className="justify-content-between border-b mt-2">
        <Col>Lender</Col>
        <Col className="text-end mb-2">
          <Lender {...contract.lender} />
        </Col>
      </Row>
      <Row className="justify-content-between border-b mt-2">
        <Col>Contract status</Col>
        <Col className="text-end mb-2">
          <Badge bg="primary">{contractStatusToLabelString(contract.status)}</Badge>
        </Col>
      </Row>
      <Row className="justify-content-between border-b mt-2">
        <Col md={6}>Loan amount</Col>
        <Col md={6} className="text-end mb-2">
          <Usd value={loanAmount} />
        </Col>
      </Row>
      <Row className="justify-content-between border-b mt-2">
        <Col>LTV ratio</Col>
        <Col className="text-end mb-2">{initialLtvFormatted}%</Col>
      </Row>
      <Row className="justify-content-between border-b mt-2">
        <Col>Interest rate p.a.</Col>
        <Col className="text-end mb-2">
          {interestRate}%
        </Col>
      </Row>

      <Row className="justify-content-between border-b mt-2">
        <Col>Collateral</Col>
        <Col className="text-end mb-2">
          {collateral.toFixed(8)} BTC
        </Col>
      </Row>
      <Row className="justify-content-between mt-2">
        <Col md={6}>Origination fee (1%)</Col>
        <Col md={6} className="text-end">
          <OverlayTrigger
            placement="top"
            overlay={<Tooltip>${loanOriginatorFeeUsd}</Tooltip>}
          >
            <span>{loanOriginatorFee.toFixed(8)} BTC</span>
          </OverlayTrigger>
        </Col>
      </Row>
      <Row className="mt-2 border-top pt-2">
        <Col md={6}>
          <strong>Total:</strong>
        </Col>
        <Col md={6} className="text-end">
          <strong>
            {totalCollateral} BTC
          </strong>
        </Col>
      </Row>
    </Container>
  );
}

interface ContractStatusDetailsProps {
  contract: Contract;
  totalCollateral: string;
  contractAddress: string;
  totalRepaymentAmount: number;
}

const ContractStatusDetails = (
  { contract, totalCollateral, contractAddress, totalRepaymentAmount }: ContractStatusDetailsProps,
) => {
  switch (contract.status) {
    case ContractStatus.Requested:
      return <ContractRequested createdAt={contract.created_at} />;
    case ContractStatus.Approved:
      return (
        <CollateralContractDetails
          collateral={totalCollateral}
          collateralAddress={contractAddress}
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
      return <ContractRepaid contract={contract} />;
    case ContractStatus.Closed:
    case ContractStatus.Closing:
    case ContractStatus.Rejected:
    default:
      return "";
  }
};
