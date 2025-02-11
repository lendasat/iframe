import { faExclamationCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Alert, Container } from "react-bootstrap";

export function ContractUndercollateralized() {
  return (
    <Container fluid>
      <Alert variant="danger">
        <FontAwesomeIcon icon={faExclamationCircle} className="h-4 w-4 mr-2" />
        Your contract LTV ratio reached the liquidation threshold. We are
        waiting for the lender to liquidate the collateral. The remainder will
        be sent to your refund address.
      </Alert>
    </Container>
  );
}
