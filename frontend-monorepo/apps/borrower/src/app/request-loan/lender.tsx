import { Container, Row } from "react-bootstrap";
import { Link } from "react-router-dom";

export interface LenderProfile {
  name: string;
  rate: number;
  loans: number;
}

export function Lender({ name, rate, loans }: LenderProfile) {
  return (
    <>
      <Container className={"p-0"}>
        <Row>
          <Link className="link-primary" to={"/profile/{name}"}>{name}</Link>
        </Row>
        <Row>
          <small>{rate}% rate, {loans} loans</small>
        </Row>
      </Container>
    </>
  );
}
