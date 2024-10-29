import { faCheckCircle, faX } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { ChangeEvent, FormEvent } from "react";
import { useState } from "react";
import { Button, Col, Container, Form, InputGroup, Row } from "react-bootstrap";
import { Link } from "react-router-dom";
import { ReactComponent as Logo } from "../lendasat_white_bg.svg";

interface ResetPasswordFormProps {
  handleSubmit: (password: string, confirmPassword: string) => Promise<string>;
  loginUrl: string;
}

export function ResetPasswordForm({ handleSubmit, loginUrl }: ResetPasswordFormProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setLoading] = useState(false);
  const [passwordMatch, setPasswordMatch] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const success = await handleSubmit(password, confirmPassword);
      setSuccess(success);
    } catch (err) {
      console.error("Failed update password: ", err);
      setError(`${err}`);
    }
    setLoading(false);
  };
  const onConfirmPasswordChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const confirmPasswordInput = e.target.value;
    setConfirmPassword(confirmPasswordInput);
    if (confirmPasswordInput !== password) {
      setError(`Passwords do not match`);
      setPasswordMatch(false);
    } else {
      setPasswordMatch(true);
      setError(``);
    }
  };

  return (
    <Container className="d-flex flex-column justify-content-center align-items-center vh-100">
      <Row className="w-100">
        <Col className="d-flex justify-content-center">
          <div className="p-4 rounded border border-primary" style={{ backgroundColor: "#f8f9fa" }}>
            <Logo height={80} width={400} className="mb-4 d-block mx-auto" />

            {(!error && !success)
              ? <div className="alert alert-info">Please enter your new password</div>
              : ""}

            {error && <div className="alert alert-danger">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <Form onSubmit={onSubmit}>
              <Form.Group controlId="formBasicPassword" className="mb-3">
                <Form.Control
                  type="Password"
                  placeholder="Password"
                  className="p-3"
                  style={{ width: "100%" }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Form.Group>

              <Form.Group controlId="formBasicPassword" className="mb-3">
                <InputGroup className="mb-3">
                  <Form.Control
                    type={"Password"}
                    placeholder={"Confirm password"}
                    value={confirmPassword}
                    onChange={onConfirmPasswordChange}
                    className="p-3"
                  />
                  {
                    <div className="position-absolute top-50 end-0 translate-middle-y me-2">
                      {passwordMatch
                        ? <FontAwesomeIcon icon={faCheckCircle} color={"green"} />
                        : <FontAwesomeIcon icon={faX} color={"red"} />}
                    </div>
                  }
                </InputGroup>
              </Form.Group>

              {success
                ? (
                  <Link to={loginUrl} className={`text-decoration-none}`}>
                    <Button variant="primary" className="w-100 p-2">
                      {"To Login"}
                    </Button>
                  </Link>
                )
                : (
                  <Button variant="primary" type="submit" className="w-100 p-2" disabled={isLoading}>
                    {isLoading ? "Loading…" : "Submit"}
                  </Button>
                )}
            </Form>
          </div>
        </Col>
      </Row>
    </Container>
  );
}

export default ResetPasswordForm;
