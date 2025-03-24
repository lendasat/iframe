import "./App.css";
import PaymentWidget from "./Widget";
import { useState } from "react";

function App() {
  const [label, setLabel] = useState("");
  const handlePaymentSuccess = (data: string) => {
    console.log("Payment successful!", data);
    // Update UI or state based on successful payment
    setLabel(data);
  };

  const handlePaymentCancel = () => {
    console.log("Payment cancelled");
    // Handle cancellation
  };

  const handlePaymentError = (error) => {
    console.error("Payment error:", error);
    // Display error message to user
  };

  return (
    <div>
      <h1>Your Shopping Cart</h1>
      <div className="cart-total">Total: $99.99</div>
      <p>{label}</p>

      <PaymentWidget
        amount={99.99}
        currency="USD"
        onSuccess={handlePaymentSuccess}
        onCancel={handlePaymentCancel}
        onError={handlePaymentError}
        buttonText="Checkout Now"
      />
    </div>
  );
}

export default App;
