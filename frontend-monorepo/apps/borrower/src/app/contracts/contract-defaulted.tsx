import { faExclamationCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Alert, Container } from "react-bootstrap";

export function ContractDefaulted() {
  return (
    <Container fluid>
      <Alert variant="danger">
        <FontAwesomeIcon icon={faExclamationCircle} className="h-4 w-4 mr-2" />
        You have defaulted on your contract. We are waiting for the lender to
        liquidate the collateral. The remainder will be sent to your refund
        address.
      </Alert>
    </Container>
  );
}
