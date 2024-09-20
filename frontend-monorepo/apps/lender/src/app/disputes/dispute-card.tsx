import { faChevronDown, faChevronUp, faExclamationCircle, faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { useEffect, useState } from "react";
import { Alert, Button, Card, Col, Collapse, Dropdown, Form, Row } from "react-bootstrap";

interface ExpandableDisputeCardProps {
  info: string;
  error: string;
  onStartDispute: (selectedReason: string, comment: string) => void;
  startingDisputeLoading: boolean;
  disputeInProgress: boolean;
}

const AlertMessage = ({ variant, icon, children }) => (
  <Alert variant={variant}>
    <FontAwesomeIcon icon={icon} className="me-2" />
    {children}
  </Alert>
);

export const ExpandableDisputeCard = (
  { info, error, onStartDispute, startingDisputeLoading, disputeInProgress }: ExpandableDisputeCardProps,
) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [isOtherReasonValid, setIsOtherReasonValid] = useState(true);

  const disputeReasons = [
    "Repayment issue: Did not receive correct amount",
    "Other",
  ];

  useEffect(() => {
    if (selectedReason === "Other") {
      setIsOtherReasonValid(otherReason.trim() !== "");
    } else {
      setIsOtherReasonValid(true);
    }
  }, [selectedReason, otherReason]);

  const getAlertContent = () => {
    if (info) {
      return (
        <AlertMessage variant="info" icon={faInfoCircle}>
          {info}
        </AlertMessage>
      );
    } else if (disputeInProgress) {
      return (
        <AlertMessage variant="warning" icon={faInfoCircle}>
          A dispute is currently in progress. Please share any additional information via email.
        </AlertMessage>
      );
    } else {
      return (
        <AlertMessage variant="warning" icon={faInfoCircle}>
          Something is not right? Please start a dispute. Before doing so ensure that your email address is up to date.
        </AlertMessage>
      );
    }
  };

  return (
    <Card className="mt-4">
      <Card.Header
        onClick={() => setIsOpen(!isOpen)}
        className="d-flex justify-content-between align-items-center"
        style={{ cursor: "pointer" }}
      >
        <span>Dispute Information</span>
        <FontAwesomeIcon icon={isOpen ? faChevronUp : faChevronDown} />
      </Card.Header>
      <Collapse in={isOpen}>
        <div>
          <Card.Body>
            {getAlertContent()}
            <Form>
              <Row className="align-items-end">
                <Col xs={12} md={6}>
                  <Dropdown>
                    <Dropdown.Toggle variant="secondary" id="dropdown-dispute-reason">
                      {selectedReason || "Select reason"}
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                      {disputeReasons.map((reason, index) => (
                        <Dropdown.Item
                          key={index}
                          onClick={() => setSelectedReason(reason)}
                        >
                          {reason}
                        </Dropdown.Item>
                      ))}
                    </Dropdown.Menu>
                  </Dropdown>
                </Col>
                <Col xs={12} md={6}>
                  <Form.Group controlId="otherReasonInput">
                    <Form.Control
                      type="text"
                      placeholder="Please describe the reason for the dispute."
                      value={otherReason}
                      onChange={(e) => setOtherReason(e.target.value)}
                      isInvalid={!isOtherReasonValid}
                    />
                    <Form.Control.Feedback type="invalid">
                      Please provide a reason for the dispute.
                    </Form.Control.Feedback>
                  </Form.Group>
                </Col>
              </Row>
              <Row>
                <Col xs={12}>
                  <Button
                    onClick={(event) => {
                      event.preventDefault();
                      onStartDispute(selectedReason, otherReason);
                    }}
                    disabled={startingDisputeLoading || !selectedReason || !isOtherReasonValid}
                    className="w-100 mt-3"
                  >
                    Start dispute
                  </Button>
                </Col>
              </Row>
            </Form>
            {!disputeInProgress && error && (
              <AlertMessage variant="danger" icon={faExclamationCircle} className="mt-3">
                {error}
              </AlertMessage>
            )}
          </Card.Body>
        </div>
      </Collapse>
    </Card>
  );
};
