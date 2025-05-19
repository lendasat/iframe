import React, { useState, ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Input,
} from "@frontend/shadcn";

interface PasswordDialogProps {
  children: ReactNode;
  onPasswordSubmit: (password: string) => void;
}

const PasswordDialog = ({
  children,
  onPasswordSubmit,
}: PasswordDialogProps) => {
  const [password, setPassword] = useState("");
  const [open, setOpen] = useState(false);

  const handleConfirm = (e: React.FormEvent) => {
    e.stopPropagation();
    if (password.trim() === "") return;

    onPasswordSubmit(password);
    setPassword("");
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent className="sm:max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleConfirm(e);
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Password Required</AlertDialogTitle>
            <AlertDialogDescription>
              Please enter your password to continue
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4">
            <Input
              type="password"
              value={password}
              autoComplete={"on"}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={"Enter your password"}
              autoFocus
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel type="button" onClick={() => setPassword("")}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction type="submit" disabled={password.trim() === ""}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default PasswordDialog;
