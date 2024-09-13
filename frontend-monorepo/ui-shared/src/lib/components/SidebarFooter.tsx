import styled from "@emotion/styled";
import { Version } from "@frontend-monorepo/base-http-client";
import React from "react";
import { Col, Row } from "react-bootstrap";
import { FaDiscord, FaGithub, FaGlobe } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { Typography } from "./Typography";

interface SidebarFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  collapsed?: boolean;
  backendVersion: Version;
}

const StyledSidebarFooter = styled.div`
  width: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  border-radius: 8px;
  color: #484848;
`;

export const SidebarFooter: React.FC<SidebarFooterProps> = ({ children, collapsed, backendVersion, ...rest }) => {
  const versionString = `${backendVersion.version}-${backendVersion.commit_hash.substring(0, 5)}`;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        paddingBottom: "5px",
      }}
    >
      {!collapsed && (
        <StyledSidebarFooter {...rest}>
          <Typography variant="caption" style={{ letterSpacing: 1, opacity: 0.7 }}>
            {versionString}
          </Typography>
          <Row className="justify-content-center mt-3">
            <Col md={6} className="d-flex justify-content-around">
              <a href="https://x.com/lendasat" target="_blank" rel="noopener noreferrer" className="mx-3">
                <FaXTwitter size={"20"} color={"black"} />
              </a>
              <a href="https://lendasat.com" target="_blank" rel="noopener noreferrer" className="mx-3">
                <FaGlobe size={"20"} color={"black"} />
              </a>
              <a href="https://github.com/lendasat" target="_blank" rel="noopener noreferrer" className="mx-3">
                <FaGithub size={"20"} color={"black"} />
              </a>
              <a
                href="https://discord.gg/kyxqWFKMCF"
                target="_blank"
                rel="noopener noreferrer"
                className="mx-3"
              >
                <FaDiscord size={"20"} color={"black"} />
              </a>
            </Col>
          </Row>
        </StyledSidebarFooter>
      )}
    </div>
  );
};
