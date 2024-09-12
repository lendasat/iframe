import { LenderProfile } from "@frontend-monorepo/http-client-borrower";
import { Container, Row } from "react-bootstrap";
import { Link } from "react-router-dom";

export function Lender({ name, rate, loans }: LenderProfile) {
  return (
    <Container className={"p-0"} fluid>
      <Row>
        <Link className="link-primary" to={`/profile/${name}`}>{name}</Link>
      </Row>
      <Row>
        <small>{rate ? <>{rate}%,</> : ""} {loans} loans</small>
      </Row>
    </Container>
  );
}
