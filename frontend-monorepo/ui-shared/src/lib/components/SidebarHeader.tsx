import styled from "@emotion/styled";
import React from "react";
import { Link } from "react-router-dom";
import Lendasat from "./../assets/lendasat.png";
import FullLogoWhiteBg from "../full-logo-white-bg";

interface SidebarHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

const StyledSidebarHeader = styled.div`
  // height: 64px;
  // min-height: 64px;
  display: flex;
  align-items: center;
  // padding: 0 0px;

  > div {
    width: 100%;
    overflow: hidden;
  }
`;

export const SidebarHeader: React.FC<SidebarHeaderProps> = ({ children, ...rest }) => {
  return (
    <StyledSidebarHeader {...rest}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <Link to="/">
          {/* <FullLogoWhiteBg /> */}
          <img src={Lendasat} alt="Logo" className="h-6 w-auto" />
        </Link>
      </div>
    </StyledSidebarHeader>
  );
};
