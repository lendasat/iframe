import {
  contractStatusToLabelString,
  LoanType,
} from "@frontend/http-client-borrower";
import type { Contract } from "@frontend/http-client-borrower";
import { formatCurrency } from "@frontend/ui-shared";
import { Callout } from "@radix-ui/themes";
import { Col, Container, Form, InputGroup, Row } from "react-bootstrap";
import { FaInfoCircle } from "react-icons/fa";

interface CollateralSeenOrConfirmedProps {
  collateral: string;
  collateralAddress: string;
  contract: Contract;
}

export function CollateralSeenOrConfirmed({
  collateral,
  collateralAddress,
  contract,
}: CollateralSeenOrConfirmedProps) {
  // biome-ignore lint/suspicious/noImplicitAnyLet: <explanation>
  let info;
  switch (contract.loan_type) {
    case LoanType.PayWithMoon:
      info = (
        <>
          Your loan amount of {formatCurrency(contract.loan_amount)} will be
          sent to your Moon card. Once confirmed, you will receive an email and
          you can start using your card.
        </>
      );
      break;
    case LoanType.StableCoin:
      info = (
        <>
          Your loan amount of {formatCurrency(contract.loan_amount)} will be
          sent to this address.
          <InputGroup className="mt-2">
            <Form.Control
              type="text"
              value={contract.borrower_loan_address}
              disabled
              readOnly
              className="dark:bg-dark-700 text-font dark:text-font-dark bg-white"
            />
          </InputGroup>
        </>
      );
      break;
    case LoanType.Fiat:
      info = (
        <>
          Your loan amount of {formatCurrency(contract.loan_amount)} will be
          sent your bank account.
        </>
      );
      break;
  }

  return (
    <Container fluid>
      <Row>
        <h4 className={"text-font dark:text-font-dark"}>
          {contractStatusToLabelString(contract.status)}
        </h4>
      </Row>

      <Row className="mt-4">
        <Col className="text-center">
          <div className="d-flex justify-content-center align-items-center flex-column">
            <p className="text-break text-font dark:text-font-dark mt-2">
              <strong>{collateral} BTC</strong> are locked in{" "}
              <strong>{collateralAddress}</strong>.
              {/*  TODO: add transaction id*/}
            </p>
          </div>
        </Col>
      </Row>
      <Row className="justify-content-between mt-4">
        <Callout.Root color={"teal"}>
          <Callout.Icon>
            <FaInfoCircle
              className={"text-font dark:text-font-dark"}
              size={"18"}
            />
          </Callout.Icon>
          <Callout.Text className={"text-font dark:text-font-dark"}>
            {info}
          </Callout.Text>
        </Callout.Root>
      </Row>
    </Container>
  );
}
