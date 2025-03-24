// PaymentWidget.jsx - Main component to be used in host websites
import { Button } from "@/components/ui/button";

const PaymentWidget = ({
  amount,
  currency = "USD",
  onSuccess,
  onCancel,
  onError,
  buttonText = "Pay Now",
  buttonVariant = "default",
  buttonSize = "default",
  clientId = "your-client-id",
  widgetName = "PaymentWidget",
}) => {
  const openPaymentPopup = () => {
    // Calculate center position for the popup
    const width = 500;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    // Open the popup window
    const popup = window.open(
      "",
      widgetName,
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`,
    );

    if (!popup) {
      onError?.({
        error: "popup_blocked",
        message: "Popup was blocked by the browser",
      });
      return;
    }

    // Create the URL with query parameters
    const popupUrl = new URL("/payment-popup", window.location.origin);
    popupUrl.searchParams.append("amount", amount);
    popupUrl.searchParams.append("currency", currency);
    popupUrl.searchParams.append("clientId", clientId);

    // Set the popup content and handle communication
    popup.document.write(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Complete Your Payment</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f7f7f7;
            color: #333;
          }
          .container {
            max-width: 450px;
            margin: 0 auto;
            background-color: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          }
          h1 {
            font-size: 24px;
            margin-bottom: 20px;
            color: #2d2d2d;
          }
          .amount {
            font-size: 32px;
            font-weight: bold;
            margin: 20px 0;
            color: #2d2d2d;
          }
          .btn {
            display: block;
            width: 100%;
            padding: 12px;
            background-color: #0070ba;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
            margin-bottom: 12px;
          }
          .btn:hover {
            background-color: #005ea6;
          }
          .btn-cancel {
            background-color: transparent;
            color: #666;
            border: 1px solid #ddd;
          }
          .btn-cancel:hover {
            background-color: #f5f5f5;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Complete Your Payment</h1>
          <p>You're paying:</p>
          <div class="amount">${currency} ${amount}</div>

          <button id="pay-button" class="btn">Complete Payment</button>
          <button id="cancel-button" class="btn btn-cancel">Cancel</button>
        </div>

        <script>
          // Simulate payment process
          document.getElementById('pay-button').addEventListener('click', function() {
            // Simulate API call to payment processor
            this.textContent = "Processing...";
            this.disabled = true;

            // Simulate payment process with timeout
            setTimeout(() => {
              // Send success message to parent window
              window.opener.postMessage({
                status: 'success',
                transaction_id: 'txn_' + Math.random().toString(36).substr(2, 9),
                amount: ${amount},
                currency: '${currency}'
              }, '*');

              // Close the popup after successful payment
              window.close();
            }, 2000);
          });

          // Handle cancel button
          document.getElementById('cancel-button').addEventListener('click', function() {
            window.opener.postMessage({
              status: 'cancelled'
            }, '*');

            window.close();
          });
        </script>
      </body>
      </html>
    `);

    // Set up event listener for messages from the popup
    const messageHandler = (event) => {
      // Validate origin of the message if needed
      // if (event.origin !== expectedOrigin) return;

      const data = event.data;

      if (data.status === "success") {
        onSuccess?.("hello world");
      } else if (data.status === "cancelled") {
        onCancel?.();
      } else if (data.status === "error") {
        onError?.(data);
      }

      // Clean up event listener when done
      window.removeEventListener("message", messageHandler);
    };

    window.addEventListener("message", messageHandler);

    // Handle popup being closed by user
    const popupCheckInterval = setInterval(() => {
      if (popup.closed) {
        clearInterval(popupCheckInterval);
        window.removeEventListener("message", messageHandler);
        onCancel?.({ reason: "popup_closed" });
      }
    }, 500);
  };

  return (
    <Button
      onClick={openPaymentPopup}
      variant={buttonVariant}
      size={buttonSize}
    >
      {buttonText}
    </Button>
  );
};

export default PaymentWidget;
