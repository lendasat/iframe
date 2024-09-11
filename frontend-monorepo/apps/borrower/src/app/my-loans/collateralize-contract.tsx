import QRCode from "qrcode.react";
import React from "react";
import { Col, Container, OverlayTrigger, Row, Tooltip } from "react-bootstrap";

interface CollateralContractDetailsProps {
  collateral_btc: number;
  totalCollateral: string;
  collateralAddress: string;
  loanOriginatorFeeUsd: string;
  loanOriginatorFee: number;
}

export function CollateralContractDetails({
  collateral_btc,
  totalCollateral,
  collateralAddress,
  loanOriginatorFee,
  loanOriginatorFeeUsd,
}: CollateralContractDetailsProps) {
  return (
    <Container fluid>
      <Row>
        <h4>Fund Collateral Contract</h4>
      </Row>
      <Row className="justify-content-between mt-2">
        <Col>Collateral</Col>
        <Col className="text-end mb-1">
          {collateral_btc.toFixed(8)} BTC
        </Col>
      </Row>
      <Row className="justify-content-between ">
        <Col md={6}>Origination fee (1%)</Col>
        <Col md={6} className="text-end mb-1">
          <OverlayTrigger
            placement="top"
            overlay={<Tooltip>${loanOriginatorFeeUsd}</Tooltip>}
          >
            <span>{loanOriginatorFee.toFixed(8)} BTC</span>
          </OverlayTrigger>
        </Col>
      </Row>
      <Row className="mt-2 border-top pt-2">
        <Col md={6}>
          <strong>Total:</strong>
        </Col>
        <Col md={6} className="text-end">
          <strong>
            {totalCollateral} BTC
          </strong>
        </Col>
      </Row>
      <Row className="mt-4">
        <Col className="text-center">
          <div className="d-flex justify-content-center align-items-center flex-column">
            <QRCode value={collateralAddress} size={200} />
            <p className="mt-2 text-break">
              Send <strong>{totalCollateral} BTC</strong> to <strong>{collateralAddress}</strong>.
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
