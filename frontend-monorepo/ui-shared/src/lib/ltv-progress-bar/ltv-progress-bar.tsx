import React from "react";
import { Spinner } from "react-bootstrap";

interface LtvProgressBarProps {
  ltvRatio?: number;
}

export const LtvProgressBar: React.FC<LtvProgressBarProps> = ({ ltvRatio }) => {
  let barColor = "";

  const isNan = ltvRatio == undefined || isNaN(ltvRatio);

  const formattedValue = isNan ? "Loading" : ltvRatio!.toFixed(0);

  if (isNan) {
    barColor = "bg-secondary";
  } else if (ltvRatio < 70) {
    barColor = "bg-success";
  } else if (ltvRatio < 90) {
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
          style={{ width: `${ltvRatio ? ltvRatio : 50}%` }}
          aria-valuenow={ltvRatio ? ltvRatio : 50}
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
