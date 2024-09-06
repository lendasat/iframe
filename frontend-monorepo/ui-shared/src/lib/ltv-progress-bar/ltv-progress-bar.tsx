import React from "react";
import { Spinner } from "react-bootstrap";

interface LtvProgressBarProps {
  value?: number;
}

export const LtvProgressBar: React.FC<LtvProgressBarProps> = ({ value }) => {
  let barColor = "";

  const ltvRation = value ? value * 100 : undefined;
  const isNan = ltvRation == undefined || isNaN(ltvRation);

  const formattedValue = isNan ? "Loading" : ltvRation!.toFixed(0);

  if (isNan) {
    barColor = "bg-secondary";
  } else if (ltvRation < 70) {
    barColor = "bg-success";
  } else if (ltvRation < 90) {
    barColor = "bg-warning";
  } else {
    barColor = "bg-danger";
  }

  return (
    <div className="d-flex justify-content-center align-items-center" style={{ height: "100%" }}>
      <div className="progress" style={{ width: "100%", height: "20px", backgroundColor: "#e9ecef" }}>
        <div
          className={`progress-bar ${barColor} d-flex justify-content-center align-items-center`}
          role="progressbar"
          style={{ width: `${ltvRation ? ltvRation : 50}%` }}
          aria-valuenow={ltvRation ? ltvRation : 50}
          aria-valuemin="0"
          aria-valuemax="100"
        >
          {isNan
            ? (
              <Spinner animation="border" role="status" variant="light" size="sm">
                <span className="visually-hidden">Loading...</span>
              </Spinner>
            )
            : <>{formattedValue}%</>}
        </div>
      </div>
    </div>
  );
};

export default LtvProgressBar;
