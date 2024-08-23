import React, { useState } from "react";
import { Button, Col, Container, Form, Row } from "react-bootstrap";
import { Link } from "react-router-dom";
import { ReactComponent as Logo } from "../lendasat_white_bg.svg";

interface LoginFormProps {
  handleLogin: (email: string, password: string) => Promise<void>;
  registrationLink: string;
}

export function LoginForm({ handleLogin, registrationLink }: LoginFormProps) {
  const [email, setEmail] = useState("bob_the_borrower@lendasat.com");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await handleLogin(email, password);
    } catch (err) {
      console.error("Login failed: ", err);
      setError(`Login failed. ${err}`);
    }
  };

  return (
    <Container className="d-flex flex-column justify-content-center align-items-center vh-100">
      <Row className="w-100">
        <Col className="d-flex justify-content-center">
          <div className="p-4 rounded border border-primary" style={{ backgroundColor: "#f8f9fa" }}>
            <Logo height={80} width={400} className="mb-4 d-block mx-auto" />

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

              {error && <div className="alert alert-danger">{error}</div>}

              <Button variant="primary" type="submit" className="w-100 p-2">
                Login
              </Button>
            </Form>

            <Container className="d-flex justify-content-center w-100 mt-2">
              <Link to={registrationLink}>Sign Up</Link>
            </Container>
          </div>
        </Col>
      </Row>
    </Container>
  );
}

export default LoginForm;
