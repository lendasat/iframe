import React, { CSSProperties, ButtonHTMLAttributes } from "react";
import { Bitcoin } from "lucide-react";

// Define types for success, cancel, and error callbacks
type SuccessData = {
  transactionId?: string;
  amount?: number;
  [key: string]: any;
};

type ErrorData = {
  error: string;
  message: string;
  [key: string]: any;
};

type CancelData = {
  reason?: string;
  [key: string]: any;
};

// Define props interface with proper typing
interface LendasatButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  amount: number;
  currency?: string;
  onSuccess?: (data: SuccessData) => void;
  onCancel?: (data?: CancelData) => void;
  onError?: (error: ErrorData) => void;
  buttonText?: string;
  clientId?: string;
  widgetName?: string;
  // Style options
  buttonStyle?: CSSProperties;
  className?: string;
  showBitcoinIcon?: boolean;
}

export const LendasatButton: React.FC<LendasatButtonProps> = ({
  amount,
  currency = "USD",
  onSuccess,
  onCancel,
  onError,
  buttonText = "Pay with Bitcoin Loan",
  clientId,
  widgetName = "PaymentWidget",
  buttonStyle,
  className,
  showBitcoinIcon = true,
  ...buttonProps // Capture remaining button attributes like disabled, aria-label, etc.
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

    // Set up event listener for messages from the popup
    const messageHandler = (event: MessageEvent) => {
      // Validate origin of the message if needed
      // if (event.origin !== expectedOrigin) return;

      console.log(`${JSON.stringify(event.data)}`);

      const data = event.data;

      if (data.status === "success") {
        onSuccess?.(data.message);
        popup.close();
      } else if (data.status === "cancelled") {
        onCancel?.(data.data);
        popup.close();
      } else if (data.status === "error") {
        onError?.(data);
        popup.close();
      }
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

  const defaultButtonStyle: CSSProperties = {
    backgroundColor: "#4CAF50",
    color: "white",
    padding: "10px 20px",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "16px",
    ...buttonStyle,
  };

  return (
    <button
      onClick={openPaymentPopup}
      style={buttonStyle || defaultButtonStyle}
      className={className}
      {...buttonProps}
    >
      {showBitcoinIcon && <Bitcoin className="h-4 w-4" />}
      {buttonText}
    </button>
  );
};
