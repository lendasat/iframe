import React from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { Col, Container, Nav, Row } from "react-bootstrap";
import { ReactComponent as Logo } from "./lendasat_white_bg.svg";

export function Layout({
  children,
  navItems = [], // Array of nav items with properties { href, label }
  title = "Default Title",
  description = "Default description",
}) {
  return (
    <div className="d-flex">
      {/* Sidebar */}
      <Container fluid>
        <Row>
          <Col xs={2} id="sidebar-wrapper" className="vh-100 p-0">
            <Nav
              className="col-md-12 d-none d-md-block bg-light sidebar h-100"
              activeKey="{selectedKey}"
            >
              <div className="sidebar-sticky"></div>
              <center>
                <Logo height={80} width={"80%"} />
              </center>
              {navItems.map((item, index) => (
                <Nav.Item key={index}>
                  <Nav.Link href={item.href}>{item.label}</Nav.Link>
                </Nav.Item>
              ))}
            </Nav>
          </Col>
          <Col xs={10} id="page-content-wrapper">
            {/* Main content */}
            <div className="flex-grow-1">
              {/* Content area */}

              <div className="px-4 py-5 my-5 text-center">
                <center>
                  <Logo height={80} width={400} />
                </center>
                <h1 className="display-5 fw-bold">{title}</h1>
                <div className="col-lg-6 mx-auto">
                  <p className="lead mb-4">{description}</p>
                </div>
              </div>

              <div className="p-4">{children}</div>
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

export default Layout;
