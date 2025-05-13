import React, { ReactElement, cloneElement } from "react";

// Define types for success, cancel, and error callbacks
type SuccessData = {
  contractId: string;
};

type ErrorData = {
  error: string;
  message: string;
  // biome-ignore lint/suspicious/noExplicitAny: good enough
  [key: string]: any;
};

type CancelData = {
  reason?: string;
  // biome-ignore lint/suspicious/noExplicitAny: good enough
  [key: string]: any;
};

type Network = "mainnet" | "test";

// Define button element props to properly type the children
type ButtonElementProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
};

// Define props interface with proper children typing
interface LendasatButtonProps {
  amount: number;
  lenderId: string;
  orderId: string;
  borrowerInviteCode: string;
  network: Network;
  onSuccess?: (data: SuccessData) => void;
  onCancel?: (data?: CancelData) => void;
  onError?: (error: ErrorData) => void;
  widgetName?: string;
  // The children should be a React element (button) with button props
  children: ReactElement<ButtonElementProps>;
}

export const LendasatButton: React.FC<LendasatButtonProps> = ({
  amount,
  lenderId,
  orderId,
  network,
  borrowerInviteCode,
  onSuccess,
  onCancel,
  onError,
  widgetName,
  children,
}) => {
  const openPaymentPopup = () => {
    // Calculate center position for the popup
    const width = 500;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    let url: string = "";

    if (network === "mainnet") {
      url = import.meta.env.VITE_WEBSHOP_POPUP_MAIN_URL;
    } else {
      url = import.meta.env.VITE_WEBSHOP_POPUP_TEST_URL;
    }

    // Open the popup window
    const popup = window.open(
      `${url}?amount=${amount}&lender_id=${lenderId}&order_id=${orderId}&code=${borrowerInviteCode}`,
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
      const data = event.data;

      console.log(`Popup returned: ${JSON.stringify(data)}`);

      if (data.status === "success") {
        onSuccess?.(data);
      } else if (data.status === "cancelled") {
        onCancel?.(data);
      } else if (data.status === "error") {
        onError?.(data);
      } else if (data.status === "done") {
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
