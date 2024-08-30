import styled from "@emotion/styled";
import React from "react";
import { Typography } from "./Typography";

interface SidebarFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  collapsed?: boolean;
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

export const SidebarFooter: React.FC<SidebarFooterProps> = ({ children, collapsed, ...rest }) => {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        paddingBottom: "20px",
      }}
    >
      {collapsed
        ? (
          ""
        )
        : (
          <StyledSidebarFooter {...rest}>
            <Typography variant="caption" style={{ letterSpacing: 1, opacity: 0.7 }}>
              {/*TODO: import version from package.json here, so far I failed*/}
              V 0.0.1
            </Typography>
          </StyledSidebarFooter>
        )}
    </div>
  );
};
