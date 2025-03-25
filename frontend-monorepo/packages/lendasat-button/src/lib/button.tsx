export const LendasatButton = ({
  amount,
  currency = "USD",
  onSuccess,
  onCancel,
  onError,
  buttonText = "Pay Now",
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
      "http://localhost:4202",
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

    // Set the popup content and handle communication

    // Set up event listener for messages from the popup
    const messageHandler = (event) => {
      // Validate origin of the message if needed
      // if (event.origin !== expectedOrigin) return;

      console.log(`${JSON.stringify(event.data)}`);

      const data = event.data;

      if (data.status === "success") {
        onSuccess?.(data.message);
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
    }, 50);
  };

  return <button onClick={openPaymentPopup}>{buttonText}</button>;
};
