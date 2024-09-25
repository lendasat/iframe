import { faInfoCircle, faStar, faUserCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { useState } from "react";
import { Button, Col, Container, Form, Row } from "react-bootstrap";
import { Link } from "react-router-dom";
import { ReactComponent as Logo } from "./../assets/lendasat_svg_logo.svg";
import Vector from "./../assets/vector.png";

interface LoginFormProps {
  handleLogin: (email: string, password: string) => Promise<void>;
  registrationLink: string;
  forgotPasswordLink: string;
  initialUserEmail: string;
  initialUserPassword: string;
  infoMessage?: string;
}

export function LoginForm(
  { handleLogin, registrationLink, forgotPasswordLink, initialUserEmail, initialUserPassword, infoMessage }:
    LoginFormProps,
) {
  const [email, setEmail] = useState(initialUserEmail);
  const [password, setPassword] = useState(initialUserPassword);
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
    <section className="max-w-screen-2xl grid md:grid-cols-5 min-h-screen w-screen overflow-hidden">
      <div className="md:col-span-2 bg-[#623AB0] px-8 md:px-20 py-12 flex flex-col items-left space-y-10 text-white w-full">
        <Logo height={20} width={"auto"} className="w-fit" />
        <div>
          <h1 className="text-5xl font-medium leading-[1.2] max-w-sm">
            You've hodled enough. <br /> Start living, pay later.
          </h1>
          {/* <p className="max-w-sm text-xl opacity-80 leading-[1.7]">Lendasat lets you take instant loans to pay Lightning invoices. No need to sell your Bitcoin.</p> */}

          <img src={Vector} alt="Vector" className="mr-auto" />
        </div>
      </div>
      <div className="flex items-center justify-center md:col-span-3">
        <div className="d-flex justify-content-center">
          <div className="p-4 rounded border border-primary" style={{ backgroundColor: "#f8f9fa" }}>
            {infoMessage
              && (
                <div className="alert alert-info">
                  <FontAwesomeIcon icon={faInfoCircle} color={"primary"} />{"  "}{infoMessage}.
                </div>
              )}

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
              <Row className={"d-flex justify-content-center"}>
                <Col>
                  <Link to={registrationLink} className={"me-3"}>Sign Up</Link>
                  <Link to={forgotPasswordLink}>Forgot Password</Link>
                </Col>
              </Row>
            </Container>
          </div>
        </div>
      </div>
    </section>
  );
}

export default LoginForm;

{
  /* <Container className="d-flex bg-black flex-column justify-content-center align-items-center vh-100">
<Row className="w-100">
  <Col className="d-flex justify-content-center">
    <div className="p-4 rounded border border-primary" style={{ backgroundColor: "#f8f9fa" }}>
      <Logo height={80} width={400} className="mb-4 d-block mx-auto" />

      {infoMessage
        && (
          <div className="alert alert-info">
            <FontAwesomeIcon icon={faInfoCircle} color={"primary"} />{"  "}{infoMessage}.
          </div>
        )}

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
        <Row className={"d-flex justify-content-center"}>
          <Col>
            <Link to={registrationLink} className={"me-3"}>Sign Up</Link>
            <Link to={forgotPasswordLink}>Forgot Password</Link>
          </Col>
        </Row>
      </Container>
    </div>
  </Col>
</Row>
</Container> */
}
