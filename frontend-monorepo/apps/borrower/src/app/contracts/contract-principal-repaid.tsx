import { faExclamationCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Alert, Container } from "react-bootstrap";

export function ContractPrincipalRepaid() {
  return (
    <Container fluid>
      <Alert variant="info">
        <FontAwesomeIcon icon={faExclamationCircle} className="h-4 w-4 mr-2" />
        Contract has been marked as repaid. Once the lender confirms the repayment, you will be able to withdraw the
        collateral from the contract.
      </Alert>
    </Container>
  );
}
