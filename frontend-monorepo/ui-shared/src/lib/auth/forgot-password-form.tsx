import React, { useState } from "react";
import { Button, Col, Container, Form, Row } from "react-bootstrap";
import { ReactComponent as Logo } from "../lendasat_white_bg.svg";

interface ForgotPasswordProps {
  handleSubmit: (email: string) => Promise<string>;
}

export function ForgotPasswordForm({ handleSubmit }: ForgotPasswordProps) {
  const [email, setEmail] = useState("borrower@lendasat.com");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const success = await handleSubmit(email);
      setSuccess(success);
    } catch (err) {
      console.error("Failed resetting password: ", err);
      setError(`Failed resetting password. ${err}`);
    }
    setLoading(false);
  };

  return (
    <Container className="d-flex flex-column justify-content-center align-items-center vh-100">
      <Row className="w-100">
        <Col className="d-flex justify-content-center">
          <div className="p-4 rounded border border-primary" style={{ backgroundColor: "#f8f9fa" }}>
            <Logo height={80} width={400} className="mb-4 d-block mx-auto" />

            {(!error && !success)
              ? <div className="alert alert-info">Please enter your email to reset your password.</div>
              : ""}

            {error && <div className="alert alert-danger">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <Form onSubmit={onSubmit}>
              <Form.Group controlId="formBasicEmail" className="mb-3">
                <Form.Control
                  type="email"
                  placeholder="Enter email"
                  className="p-3"
                  style={{ width: "100%" }}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Form.Group>

              <Button variant="primary" type="submit" className="w-100 p-2" disabled={isLoading}>
                {isLoading ? "Loading…" : "Submit"}
              </Button>
            </Form>
          </div>
        </Col>
      </Row>
    </Container>
  );
}

export default ForgotPasswordForm;
