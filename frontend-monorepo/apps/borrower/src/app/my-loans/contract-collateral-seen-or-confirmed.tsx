import { faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { contractStatusToLabelString, Integration } from "@frontend-monorepo/http-client-borrower";
import type { Contract } from "@frontend-monorepo/http-client-borrower";
import { formatCurrency } from "@frontend-monorepo/ui-shared";
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
  let info;
  switch (contract.integration) {
    case Integration.PayWithMoon:
      info = (
        <>
          Your loan amount of {formatCurrency(contract.loan_amount)}{" "}
          will be sent to your Moon card. Once confirmed, you will receive an email and you can start using your card.
        </>
      );
      break;
    case Integration.StableCoin:
    default:
      info = (
        <>
          <FontAwesomeIcon icon={faInfoCircle} /> Your loan amount of {formatCurrency(contract.loan_amount)}{" "}
          will be sent to this address.
          <InputGroup className="mt-2">
            <Form.Control
              type="text"
              value={contract.borrower_loan_address}
              disabled
              readOnly
              className="bg-white"
            />
          </InputGroup>
        </>
      );
      break;
  }

  return (
    <Container fluid>
      <Row>
        <h4>{contractStatusToLabelString(contract.status)}</h4>
      </Row>

      <Row className="mt-4">
        <Col className="text-center">
          <div className="d-flex justify-content-center align-items-center flex-column">
            <p className="mt-2 text-break">
              <strong>{collateral} BTC</strong> are locked in <strong>{collateralAddress}</strong>.
              {/*  TODO: add transaction id*/}
            </p>
          </div>
        </Col>
      </Row>
      <Row className="justify-content-between mt-4">
        <Callout.Root color={"teal"}>
          <Callout.Icon>
            <FaInfoCircle size={"18"} />
          </Callout.Icon>
          <Callout.Text>
            {info}
          </Callout.Text>
        </Callout.Root>
      </Row>
    </Container>
  );
}
