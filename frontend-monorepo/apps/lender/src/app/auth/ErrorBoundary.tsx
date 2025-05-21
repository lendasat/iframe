import { Button } from "@frontend/shadcn";
import { AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ErrorBoundary = () => {
  const navigate = useNavigate();
  const handleGoHome = () => {
    navigate("/");
  };

  return (
    <div className="container mx-auto mt-20 px-4">
      <div className="flex justify-center">
        <div className="max-w-md text-center">
          <div className="flex justify-center mb-6">
            <AlertTriangle size={80} className="text-red-500" />
          </div>
          <h2 className="text-2xl font-semibold mb-3">
            Oops! Something went wrong
          </h2>
          <p className="text-muted-foreground mb-6">
            {"We couldn't find what you were looking for."}
          </p>
          <Button onClick={handleGoHome}>Home</Button>
        </div>
      </div>
    </div>
  );
};

export default ErrorBoundary;
