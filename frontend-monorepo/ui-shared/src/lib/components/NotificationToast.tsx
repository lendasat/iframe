import * as Toast from "@radix-ui/react-toast";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import "./NotificationToast.css";
import { Box } from "@radix-ui/themes";

type NotificationToastProps = {
  children?: ReactNode;
  title: string;
  description: string;
};

export function NotificationToast({ children, title, description }: NotificationToastProps) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef(0);

  useEffect(() => {
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
