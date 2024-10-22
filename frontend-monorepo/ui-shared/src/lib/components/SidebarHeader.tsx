import styled from "@emotion/styled";
import type { FC, HTMLAttributes, ReactNode } from "react";
import Lendasat from "./../assets/lendasat.png";

interface SidebarHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

const StyledSidebarHeader = styled.div`
  height: 64px;
  min-height: 64px;
  display: flex;
  align-items: center;
  padding: 0 0px;

  > div {
    width: 100%;
    overflow: hidden;
  }
`;

export const SidebarHeader: FC<SidebarHeaderProps> = ({ children, ...rest }) => {
  return (
    <StyledSidebarHeader {...rest}>
      <div>
        {/* <FullLogoWhiteBg /> */}
        <img src={Lendasat} alt="Logo" className="h-5 w-auto" />
      </div>
    </StyledSidebarHeader>
  );
};
