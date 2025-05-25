import React, { ChangeEvent, } from "react";
import { useNavigate } from "react-router-dom";
import { ReactComponent as Logo } from "./../assets/lendasat_svg_logo.svg";
import { OldPasswordOrMnemonic } from "../models";
import { useState } from "react";
import { Button } from "@frontend/shadcn";
import { Input } from "@frontend/shadcn";
import { Label } from "@frontend/shadcn";
import { Alert, AlertDescription } from "@frontend/shadcn";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@frontend/shadcn";
import { RadioGroup, RadioGroupItem } from "@frontend/shadcn";
import { CheckCircle, X, Loader2 } from "lucide-react";

interface ResetPasswordFormProps {
  handleSubmit: (
    newPassword: string,
    oldPasswordOrMnemonic: OldPasswordOrMnemonic,
  ) => Promise<string>;
  loginUrl: string;
  canUseMnemonic: boolean;
}

export function ResetPasswordForm({
  handleSubmit,
  loginUrl,
  canUseMnemonic,
}: ResetPasswordFormProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setLoading] = useState(false);
  const [changeComplete, setChangeComplete] = useState(false);
  const [passwordMatch, setPasswordMatch] = useState(false);
  const navigate = useNavigate();

  const [oldPassOrMnemonic, setOldPassOrMnemonic] = useState("oldPassword");

  const [oldPassword, setOldPassword] = useState("");
  const [mnemonic, setMnemonic] = useState("");

  const onSubmit = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setLoading(true);
    setSuccess("");
    setChangeComplete(false);
    try {
      let extra: OldPasswordOrMnemonic;
      if (oldPassOrMnemonic === "oldPassword") {
        extra = { type: "oldPassword", value: oldPassword };
      } else if (oldPassOrMnemonic === "mnemonic") {
        extra = { type: "mnemonic", value: mnemonic };
      } else {
        throw new Error("Failed to provide current password or mnemonic");
      }

      const success = await handleSubmit(newPassword, extra);
      setSuccess(success);
      setChangeComplete(true);
    } catch (err) {
      console.error("Failed update password: ", err);
      setError(`${err}`);
    }
    setLoading(false);
  };
  const onConfirmPasswordChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const confirmPasswordInput = e.target.value;
    setConfirmNewPassword(confirmPasswordInput);
    if (confirmPasswordInput !== newPassword) {
      setError(`Passwords do not match`);
      setPasswordMatch(false);
    } else {
      setPasswordMatch(true);
      setError(``);
    }
  };

  const handleGoToLogin = () => {
    navigate(loginUrl);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-slate-50 via-slate-50 to-pink-50 p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Logo
            height={27}
            width={"auto"}
            className="w-fit invert dark:invert-0"
          />
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Reset your password</CardTitle>
            <CardDescription>Please enter your new password</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="New Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={changeComplete}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm Password"
                    value={confirmNewPassword}
                    onChange={onConfirmPasswordChange}
                    disabled={changeComplete}
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    {confirmNewPassword &&
                      (passwordMatch ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <X className="h-4 w-4 text-red-500" />
                      ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Extra Data</Label>
                <RadioGroup
                  value={oldPassOrMnemonic}
                  onValueChange={setOldPassOrMnemonic}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="oldPassword" id="oldPassword" />
                    <Label htmlFor="oldPassword">Current Password</Label>
                  </div>
                  {canUseMnemonic && (
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="mnemonic" id="mnemonic" />
                      <Label htmlFor="mnemonic">Mnemonic Seed Phrase</Label>
                    </div>
                  )}
                </RadioGroup>
              </div>

              {oldPassOrMnemonic === "oldPassword" && (
                <div className="space-y-2">
                  <Input
                    type="password"
                    placeholder="Current Password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                  />
                </div>
              )}

              {oldPassOrMnemonic === "mnemonic" && (
                <div className="space-y-2">
                  <Input
                    placeholder="abandon ability able about..."
                    value={mnemonic}
                    onChange={(e) => setMnemonic(e.target.value)}
                  />
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="border-green-200 bg-green-50 text-green-800">
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              {success ? (
                <Button onClick={handleGoToLogin} className="w-full">
                  Go To Login
                </Button>
              ) : (
                <Button
                  onClick={(e) => onSubmit(e)}
                  className="w-full -px-4"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Submit"
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ResetPasswordForm;
