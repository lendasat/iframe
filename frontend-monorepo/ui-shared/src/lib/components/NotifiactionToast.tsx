import * as Toast from "@radix-ui/react-toast";
import * as React from "react";
import "./NotificationToast.css";
import { Box } from "@radix-ui/themes";

type NotificationToastProps = {
  children?: React.ReactNode;
  title: string;
  description: string;
};

export function NotificationToast({ children, title, description }: NotificationToastProps) {
  const [open, setOpen] = React.useState(false);
  const timerRef = React.useRef(0);

  React.useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  return (
    <Toast.Provider swipeDirection="right">
      <Box
        onClick={() => {
          setOpen(false);
          window.clearTimeout(timerRef.current);
          timerRef.current = window.setTimeout(() => {
            setOpen(true);
          }, 100);
        }}
      >
        {children}
      </Box>

      <Toast.Root className="ToastRoot" open={open} onOpenChange={setOpen}>
        <Toast.Title className="ToastTitle">{title}</Toast.Title>
        <Toast.Description asChild>
          {description}
        </Toast.Description>
        {/*<Toast.Action*/}
        {/*  className="ToastAction"*/}
        {/*  asChild*/}
        {/*  altText="Action"*/}
        {/*>*/}
        {/*  <button className="Button small green">Undo</button>*/}
        {/*</Toast.Action>*/}
      </Toast.Root>
      <Toast.Viewport className="ToastViewport" />
    </Toast.Provider>
  );
}
