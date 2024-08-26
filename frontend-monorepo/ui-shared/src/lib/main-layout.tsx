import React, { ReactNode } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { Col, Container, Nav, Row } from "react-bootstrap";
import { Link  } from "react-router-dom";
import { ReactComponent as Logo } from "./lendasat_white_bg.svg";

interface NavItem {
  href: string;
  label: string;
}

interface LayoutProps {
  children: ReactNode;
  defaultActiveKey?: string;
  navItems: NavItem[];
}

export function Layout({
  children,
  defaultActiveKey,
  navItems = [],
}: LayoutProps) {
  return (
    <div className="d-flex">
      {/* Sidebar */}
      <Container fluid>
        <Row>
          <Col xs={2} id="sidebar-wrapper" className="vh-100 p-0">
            <Nav
              className="col-md-12 d-none d-md-block bg-light sidebar h-100"
              activeKey="{selectedKey}"
              defaultActiveKey={defaultActiveKey ?? 0}
            >
              <div className="sidebar-sticky"></div>
              <center>
                <Logo height={80} width={"80%"} />
              </center>
              {navItems.map((item, index) => (
                <Nav.Item key={index}>
                  <Nav.Link as={Link} to={item.href}>{item.label}</Nav.Link>
                </Nav.Item>
              ))}
            </Nav>
          </Col>
          <Col xs={10} id="page-content-wrapper">
            {/* Main content */}
            <div className="flex-grow-1">
              {/* Content area */}
              <div className="p-0">{children}</div>
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

export default Layout;
