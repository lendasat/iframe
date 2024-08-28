import React from "react";

interface LtvProgressBarProps {
  value: number;
}

export const LtvProgressBar: React.FC<LtvProgressBarProps> = ({ value }) => {
  let barColor = "";
  const formattedValue = value.toFixed(0);

  if (value < 70) {
    barColor = "bg-success";
  } else if (value < 90) {
    barColor = "bg-warning";
  } else {
    barColor = "bg-danger";
  }

  return (
    <div className="d-flex justify-content-center align-items-center" style={{ height: "100%" }}>
      <div className="progress" style={{ width: "100%", height: "20px", backgroundColor: "#e9ecef" }}>
        <div
          className={`progress-bar ${barColor}`}
          role="progressbar"
          style={{ width: `${value}%` }}
          aria-valuenow={value}
          aria-valuemin="0"
          aria-valuemax="100"
        >
          {formattedValue}%
        </div>
      </div>
    </div>
  );
};

export default LtvProgressBar;
