import { LenderProfile } from "@frontend-monorepo/http-client-borrower";
import React from "react";
import { Container, Row } from "react-bootstrap";
import { Link } from "react-router-dom";

export function Lender({ name, id }: LenderProfile) {
  return (
    <Container className={"p-0"} fluid>
      <Row>
        <Link className="link-primary" to={`/profile/${id}`}>{name}</Link>
      </Row>
    </Container>
  );
}
