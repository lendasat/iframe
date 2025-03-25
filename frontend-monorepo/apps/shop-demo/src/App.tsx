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

  // Custom styles
  const buttonStyle = {
    backgroundColor: "#3498db",
    color: "white",
    padding: "12px 24px",
    borderRadius: "8px",
    fontWeight: "bold",
    transition: "background-color 0.3s",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
  };

  return (
    <>
      <div>Shop</div>
      <div>
        <h1>Your Shopping Cart</h1>
        <div className="cart-total">Total: $99.99</div>
        <p>Transaction ID: {label}</p>

        <LendasatButton
          amount={99.99}
          currency="USD"
          buttonText="Checkout Now"
          widgetName={"Bitcoin-backed loans"}
          onSuccess={handlePaymentSuccess}
          onCancel={handlePaymentCancel}
          onError={handlePaymentError}
          buttonStyle={buttonStyle}
          className="custom-payment-button"
          aria-label="Complete checkout process"
        />
      </div>
    </>
  );
}

export default App;
