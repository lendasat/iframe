import React, { ReactElement, cloneElement } from "react";

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

// Define button element props to properly type the children
type ButtonElementProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
};

// Define props interface with proper children typing
interface LendasatButtonProps {
  amount: number;
  currency?: string;
  onSuccess?: (data: SuccessData) => void;
  onCancel?: (data?: CancelData) => void;
  onError?: (error: ErrorData) => void;
  clientId?: string;
  widgetName?: string;
  // The children should be a React element (button) with button props
  children: ReactElement<ButtonElementProps>;
}

export const LendasatButton: React.FC<LendasatButtonProps> = ({
  amount,
  currency,
  onSuccess,
  onCancel,
  onError,
  clientId,
  widgetName,
  children,
}) => {
  const openPaymentPopup = () => {
    // Calculate center position for the popup
    const width = 500;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    let url: string = import.meta.env.VITE_WEBSHOP_POPUP_URL;

    // Open the popup window
    const popup = window.open(
      `${url}?amount=${amount}`,
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

  // Clone the child element (button) and attach our onClick handler
  return cloneElement(children, {
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
      // Call the original onClick if it exists
      if (children.props.onClick) {
        children.props.onClick(e);
      }

      // Then call our handler
      openPaymentPopup();
    },
  } as ButtonElementProps);
};
