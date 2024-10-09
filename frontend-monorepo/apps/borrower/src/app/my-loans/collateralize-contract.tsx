import { faCopy } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import QRCode from "qrcode.react";
import React, { useState } from "react";
import { Button, Col, Container, OverlayTrigger, Row, Tooltip } from "react-bootstrap";

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
  const [copied, setCopied] = useState(false);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

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
            <div
              onClick={() => handleCopy(collateralAddress)}
              style={{ cursor: "pointer" }}
            >
              <QRCode value={collateralAddress} size={200} />
            </div>
            <p className="mt-2 text-break">
              Please send <strong>{totalCollateral}</strong> to:
            </p>
            <div className="d-flex align-items-center">
              <code style={{ "width": 300, textOverflow: "ellipsis" }}>{collateralAddress}</code>
              <Button
                variant="link"
                className="ms-2"
                onClick={() => handleCopy(collateralAddress)}
              >
                <FontAwesomeIcon icon={faCopy} />
              </Button>
            </div>
            {copied && <small className="text-success">Copied to clipboard!</small>}
          </div>
        </Col>
      </Row>
    </Container>
  );
}
