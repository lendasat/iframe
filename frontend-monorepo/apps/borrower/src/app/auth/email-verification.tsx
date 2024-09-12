import { faCheckCircle, faExclamationCircle, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAuth } from "@frontend-monorepo/http-client-borrower";
import { FullLogoWhiteBg } from "@frontend-monorepo/ui-shared";
import React, { useEffect, useState } from "react";
import { Alert, Button, Card, Col, Container, Row } from "react-bootstrap";
import { useNavigate, useParams } from "react-router-dom";

const EmailVerification = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState("");
  const { verifyEmail } = useBorrowerHttpClient();
  const { token } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const callVerify = async () => {
      try {
        setIsLoading(true);
        const response = await verifyEmail(token);
        console.log(response);
        setIsVerified(true);
      } catch (error) {
        console.error("Error:", error);
        setError(`${error}`);
        setIsVerified(false);
      } finally {
        setIsLoading(false);
      }
    };

    callVerify();
  }, [token, verifyEmail]);

  return (
    <Container className="d-flex align-items-center justify-content-center min-vh-100">
      <Row className="justify-content-center">
        <Col xs={12} md={8} lg={12}>
          <Card className="text-center">
            <Card.Body>
              <div className="d-flex justify-content-center mb-4">
                <FullLogoWhiteBg />
              </div>

              <div className="mb-4">
                {isLoading
                  ? <FontAwesomeIcon icon={faSpinner} className="text-4xl text-blue-500 animate-spin" />
                  : isVerified
                  ? <FontAwesomeIcon icon={faCheckCircle} className="text-4xl text-green-500" />
                  : <FontAwesomeIcon icon={faExclamationCircle} className="text-4xl text-red-500" />}
              </div>

              <p className="text-xl font-semibold mb-4">
                {isLoading
                  ? "Verifying your email..."
                  : isVerified && !error
                  ? "Email verified successfully!"
                  : ""}
              </p>

              {error && (
                <Alert variant="danger">
                  <FontAwesomeIcon icon={faExclamationCircle} className="h-4 w-4 mr-2" />
                  {error}
                </Alert>
              )}

              {!isLoading && isVerified
                ? (
                  <Button
                    variant="primary"
                    onClick={() => {
                      navigate("/");
                    }}
                    className="w-50 me-2"
                  >
                    Home
                  </Button>
                )
                : ""}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default EmailVerification;
