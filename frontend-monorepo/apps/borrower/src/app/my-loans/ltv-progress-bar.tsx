import React from "react";
import { ProgressBar } from "react-bootstrap";

const LTVProgressBar = ({ ltv }) => {
  return (
    <>
      <ProgressBar>
        <ProgressBar variant="danger" now={Math.min(ltv, 10)} key={1} />
        {ltv >= 10 && <ProgressBar variant="warning" now={Math.min(ltv - 10, 10)} key={2} />}
        {ltv >= 20 && <ProgressBar variant="success" now={ltv - 20} key={3} />}
      </ProgressBar>
      <small>{`${ltv}%`}</small>
    </>
  );
};

export default LTVProgressBar;
