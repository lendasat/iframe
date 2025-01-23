import { Text } from "@radix-ui/themes";
import type { FC } from "react";
import { Spinner } from "react-bootstrap";

interface LtvProgressBarProps {
  ltvRatio: number | undefined;
}

export const LtvProgressBar: FC<LtvProgressBarProps> = ({ ltvRatio }) => {
  let barColor = "";

  const isNan = ltvRatio == null || isNaN(ltvRatio);

  const formattedValue = isNan ? "Loading" : ltvRatio.toFixed(0);

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
    <div className="d-flex justify-content-center align-items-center gap-3" style={{ height: "100%" }}>
      <div className="progress" style={{ width: "100%", height: "4px", backgroundColor: "#e9ecef" }}>
        <div
          className={`progress-bar ${barColor} d-flex rounded-full justify-content-center align-items-center`}
          role="progressbar"
          style={{ width: `${ltvRatio ? ltvRatio : 50}%` }}
          aria-valuenow={ltvRatio ? ltvRatio : 50}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <Text className="text-xs font-medium text-font dark:text-font-dark" weight={"medium"}>
        {isNan
          ? (
            <Spinner animation="border" role="status" size="sm">
              <span className="visually-hidden text-font dark:text-font-dark">Loading...</span>
            </Spinner>
          )
          : <>{formattedValue}%</>}
      </Text>
    </div>
  );
};

export default LtvProgressBar;
