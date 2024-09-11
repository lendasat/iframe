import QRCode from "qrcode.react";
import React from "react";
import { Col, Container, Row } from "react-bootstrap";

interface CollateralContractDetailsProps {
  collateral: string;
  collateralAddress: string;
}

export function CollateralContractDetails({
  collateral,
  collateralAddress,
}: CollateralContractDetailsProps) {
  return (
    <Container fluid>
      <Row>
        <h4>Fund Collateral Contract</h4>
      </Row>

      <Row className="mt-4">
        <Col className="text-center">
          <div className="d-flex justify-content-center align-items-center flex-column">
            <QRCode value={collateralAddress} size={200} />
            <p className="mt-2 text-break">
              Send <strong>{collateral} BTC</strong> to <strong>{collateralAddress}</strong>.
            </p>
            <p className="text-break">
              <em>
                Make sure you pay the amount <strong>in full</strong>
              </em>.
            </p>
          </div>
        </Col>
      </Row>
    </Container>
  );
}
