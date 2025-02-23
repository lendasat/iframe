import { faCheckCircle, faX } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Box, Grid, Heading, Text } from "@radix-ui/themes";
import type { ChangeEvent, FormEvent } from "react";
import { useState } from "react";
import { Button, Form, InputGroup } from "react-bootstrap";
import { Link } from "react-router-dom";
import { ReactComponent as Logo } from "./../assets/lendasat_svg_logo.svg";
import { OldPasswordOrMnemonic } from "../models";

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

  const [oldPassOrMnemonic, setOldPassOrMnemonic] = useState("oldPassword");

  const [oldPassword, setOldPassword] = useState("");
  const [mnemonic, setMnemonic] = useState("");

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
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

  return (
    <Box className="flex h-screen items-center justify-center overflow-y-scroll bg-gradient-to-tr from-[#F5F9FD] from-60% to-pink-700/5 to-100% py-20 pt-0 dark:from-[#1a202c] dark:to-gray-900/70">
      <Grid align={"center"} className="w-screen grid-cols-1 overflow-hidden">
        <Box className="flex flex-col items-center p-5">
          {/* Logo */}
          <Logo
            height={27}
            width={"auto"}
            className="w-fit invert dark:invert-0"
          />

          <Box
            mt={"6"}
            maxWidth={"550px"}
            width={"100%"}
            py={"6"}
            px={"6"}
            className="bg-light dark:bg-dark rounded-2xl shadow-sm"
          >
            <Box className="pb-4 text-center">
              <Heading
                size={"7"}
                className="text-font dark:text-font-dark pb-2"
              >
                Reset your password
              </Heading>
              <Text size={"3"} className="text-font/70 dark:text-font-dark/70">
                Please enter your new password
              </Text>
            </Box>

            <Form onSubmit={onSubmit}>
              <Form.Group controlId="formBasicPassword" className="mb-3">
                <Text
                  as="label"
                  size={"1"}
                  weight={"medium"}
                  className="text-font dark:text-font-dark mb-2"
                >
                  New Password
                </Text>
                <Form.Control
                  type="Password"
                  placeholder="New Password"
                  className="text-font bg-light dark:text-font-dark dark:bg-dark dark:placeholder:text-font-dark/60 p-3"
                  style={{ width: "100%" }}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={changeComplete}
                />
              </Form.Group>

              <Form.Group controlId="formBasicPassword" className="mb-3">
                <Text
                  as="label"
                  size={"1"}
                  weight={"medium"}
                  className="text-font dark:text-font-dark mb-2"
                >
                  Confirm Password
                </Text>
                <InputGroup className="text-font dark:text-font-dark mb-3">
                  <Form.Control
                    type={"Password"}
                    placeholder="Confirm Password"
                    value={confirmNewPassword}
                    onChange={onConfirmPasswordChange}
                    className="text-font bg-light dark:text-font-dark dark:bg-dark dark:placeholder:text-font-dark/60 p-3"
                    disabled={changeComplete}
                  />

                  {
                    <div className="position-absolute top-50 translate-middle-y end-0 me-2">
                      {passwordMatch ? (
                        <FontAwesomeIcon icon={faCheckCircle} color={"green"} />
                      ) : (
                        <FontAwesomeIcon icon={faX} color={"red"} />
                      )}
                    </div>
                  }
                </InputGroup>

                <Form.Group controlId="formPasswordType">
                  <Text
                    as="label"
                    size={"1"}
                    weight={"medium"}
                    className="text-font dark:text-font-dark mb-2"
                  >
                    Extra Data
                  </Text>
                  <Box className="d-flex align-items-center mb-3 ml-3">
                    <Form.Check
                      type="radio"
                      label="Current Password"
                      name="passwordType"
                      className="text-font bg-light dark:text-font-dark dark:bg-dark mr-4 p-3"
                      onChange={() => setOldPassOrMnemonic("oldPassword")}
                      checked={oldPassOrMnemonic === "oldPassword"}
                    />
                    {canUseMnemonic && (
                      <Form.Check
                        type="radio"
                        label="Mnemonic Seed Phrase"
                        name="passwordType"
                        className="text-font bg-light dark:text-font-dark dark:bg-dark p-3"
                        onChange={() => setOldPassOrMnemonic("mnemonic")}
                        checked={oldPassOrMnemonic === "mnemonic"}
                      />
                    )}
                  </Box>
                </Form.Group>

                {oldPassOrMnemonic === "oldPassword" && (
                  <Form.Group controlId="formOldPassword">
                    <Form.Control
                      type="password"
                      placeholder="Current Password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      className="text-font bg-light dark:text-font-dark dark:bg-dark dark:placeholder:text-font-dark/60 mb-3"
                    />
                  </Form.Group>
                )}

                {oldPassOrMnemonic === "mnemonic" && (
                  <Form.Group controlId="formMnemonic">
                    <Form.Control
                      placeholder="abandon ability able about..."
                      value={mnemonic}
                      onChange={(e) => setMnemonic(e.target.value)}
                      className="text-font bg-light dark:text-font-dark dark:bg-dark dark:placeholder:text-font-dark/60 mb-3"
                    />
                  </Form.Group>
                )}

                <InputGroup>
                  {error && (
                    <div className="alert alert-danger w-100">{error}</div>
                  )}
                  {success && (
                    <div className="alert alert-success w-100">{success}</div>
                  )}
                </InputGroup>
                <InputGroup>
                  {success ? (
                    <Link to={loginUrl} className={`text-decoration-none}`}>
                      <Button variant="primary" className="w-100 p-2">
                        {"Go To Login"}
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      variant="primary"
                      type="submit"
                      className="w-100 p-2"
                      disabled={isLoading}
                    >
                      {isLoading ? "Loading…" : "Submit"}
                    </Button>
                  )}
                </InputGroup>
              </Form.Group>
            </Form>
          </Box>
        </Box>
      </Grid>
    </Box>
  );
}

export default ResetPasswordForm;
