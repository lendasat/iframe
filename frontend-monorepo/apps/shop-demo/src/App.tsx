import "./App.css";
import { useState } from "react";
import { LendasatButton } from "@frontend/lendasat-button";

function App() {
  const [label, setLabel] = useState("");

  const handlePaymentSuccess = (data: {
    transactionId?: string;
    amount?: number;
    [key: string]: any;
  }) => {
    console.log("Payment successful!", data);
    // Update UI or state based on successful payment
    setLabel(data.transactionId || JSON.stringify(data));
  };

  const handlePaymentCancel = (data?: {
    reason?: string;
    [key: string]: any;
  }) => {
    console.log("Payment cancelled", data?.reason);
    // Handle cancellation
  };

  const handlePaymentError = (error: {
    error: string;
    message: string;
    [key: string]: any;
  }) => {
    console.error("Payment error:", error.message);
    // Display error message to user
  };

  return (
    <>
      <div>
        <h1 className="mb-4 text-2xl font-bold">Your Shopping Cart</h1>
        <div className="mb-6 text-lg font-medium">Total: $99.99</div>
        {label && (
          <div className="mb-4 rounded-md bg-green-100 p-3 text-green-800">
            {label}
          </div>
        )}

        <LendasatButton
          amount={99.99}
          currency="USD"
          buttonText="Checkout Now"
          widgetName={"Bitcoin-backed loans"}
          onSuccess={handlePaymentSuccess}
          onCancel={handlePaymentCancel}
          onError={handlePaymentError}
          className="custom-payment-button"
          aria-label="Complete checkout process"
        />
      </div>
    </>
  );
}

export default App;
