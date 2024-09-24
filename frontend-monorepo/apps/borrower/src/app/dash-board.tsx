import { FullLogoWhiteBg } from "@frontend-monorepo/ui-shared";
import React from "react";
import { Button, Col, Container, Row } from "react-bootstrap";
import { FaDiscord, FaGithub, FaGlobe } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import DashHeader from "./components/DashHeader";

function DashBoard() {
  return (
    <Container className="">
      <Row className="justify-content-center">
        {/* <Col md={6} className="d-flex flex-column align-items-center">
          <FullLogoWhiteBg />
          <h1 className="mt-4">Welcome to Lendasat</h1>
          <p className="lead mt-3">
            Lendasat is your gateway to borrow against your Bitcoin in a non-custodial and peer-2-peer way.
          </p>
          <div className="mt-4">
            <Button variant="primary" href="/request-loan" className="me-3">Get a Loan</Button>
            <Button variant="secondary" href="https://whitepaper.lendasat.com/lendasat-whitepaper.pdf" target="_blank">
              Learn How It Works
            </Button>
          </div>
          <Row className="justify-content-center mt-5">
            <Col md={6} className="d-flex justify-content-around">
              <a href="https://x.com/lendasat" target="_blank" rel="noopener noreferrer" className="mx-3">
                <FaXTwitter size={"30"} color={"black"} />
              </a>
              <a href="https://lendasat.com" target="_blank" rel="noopener noreferrer" className="mx-3">
                <FaGlobe size={"30"} color={"black"} />
              </a>
              <a href="https://github.com/lendasat" target="_blank" rel="noopener noreferrer" className="mx-3">
                <FaGithub size={"30"} color={"black"} />
              </a>
              <a
                href="https://discord.gg/kyxqWFKMCF"
                target="_blank"
                rel="noopener noreferrer"
                className="mx-3"
              >
                <FaDiscord size={"30"} color={"black"} />
              </a>
            </Col>
          </Row>
        </Col> */}
      </Row>
      <DashHeader label={'Dashboard'} />
    </Container>
  );
}

export default DashBoard;
