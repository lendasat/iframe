import { faEdit } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { useState } from "react";
import { Button, Col, Container, Form, Row, Spinner } from "react-bootstrap";
import { ReactComponent as Logo } from "../lendasat_white_bg.svg";

interface RegistrationFormProps {
  handleRegister: (name: string, email: string, password: string) => Promise<void>;
}

export function RegistrationForm({ handleRegister }: RegistrationFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }
    setError("");
    try {
      await handleRegister(name, email, password);
    } catch (err) {
      console.error("Failed registering user:", err);
      setError(err instanceof Error ? err.message : "Registration failed.");
    }
    setIsLoading(false);
  };

  return (
    <Container className="d-flex flex-column justify-content-center align-items-center vh-100">
      <Row className="w-100">
        <Col className="d-flex justify-content-center">
          <div className="p-4 rounded border border-primary" style={{ backgroundColor: "#f8f9fa" }}>
            <Logo height={80} width={400} className="mb-4 d-block mx-auto" />

            <Form onSubmit={onSubmit}>
              <Form.Group controlId="formBasicName" className="mb-3">
                <Form.Control
                  type="text"
                  placeholder="Enter your name"
                  value={name}
                  className="p-3"
                  style={{ width: "100%" }}
                  onChange={(e) => setName(e.target.value)}
                />
              </Form.Group>

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

              <Form.Group controlId="formBasicPassword" className="mb-3">
                <Form.Control
                  type="password"
                  placeholder="Password"
                  className="p-3"
                  style={{ width: "100%" }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Form.Group>

              <Form.Group controlId="formBasicConfirmPassword" className="mb-3">
                <Form.Control
                  type="password"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  className="p-3"
                  style={{ width: "100%" }}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </Form.Group>

              {error && <div className="alert alert-danger">{error}</div>}

              <Button
                variant="primary"
                className="w-100 p-2"
                type={"submit"}
                disabled={isLoading}
                title="Change Password"
              >
                {isLoading
                  ? (
                    <Spinner animation="border" role="status" variant="light" size="sm">
                      <span className="visually-hidden">Loading...</span>
                    </Spinner>
                  )
                  : "Register"}
              </Button>
            </Form>
          </div>
        </Col>
      </Row>
    </Container>
  );
}
