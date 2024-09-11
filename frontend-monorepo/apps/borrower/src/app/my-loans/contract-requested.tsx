import React, { useEffect, useState } from "react";
import { Col, Container, Row } from "react-bootstrap";

interface ContractRequestedProps {
  createdAt: Date;
}

export function ContractRequested({ createdAt }: ContractRequestedProps) {
  const [timeRemaining, setTimeRemaining] = useState("");

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const expiryTime = new Date(createdAt.getTime() + 12 * 60 * 60 * 1000); // createdAt + 12 hours
      const diff = expiryTime.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining("Expired");
        clearInterval(timer);
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        setTimeRemaining(
          `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${
            seconds.toString().padStart(2, "0")
          }`,
        );
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [createdAt]);

  return (
    <Container fluid>
      <Row>
        <h4>Waiting for response</h4>
      </Row>

      <Row className="mt-4">
        <Col className="text-center">
          <div className="d-flex justify-content-center align-items-center flex-column">
            <p className="mt-2 text-break">
              Waiting for the lender to accept the loan request.
            </p>
            <p className="mt-2">
              Time remaining: <strong>{timeRemaining}</strong>
            </p>
          </div>
        </Col>
      </Row>
    </Container>
  );
}
