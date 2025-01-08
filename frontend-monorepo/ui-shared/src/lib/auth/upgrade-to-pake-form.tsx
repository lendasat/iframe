import { Box, Button, Callout, Grid, Heading, IconButton, Spinner, Text } from "@radix-ui/themes";
import type { FormEvent } from "react";
import { useState } from "react";
import { Form } from "react-bootstrap";
import { FaRegEye, FaRegEyeSlash } from "react-icons/fa";
import { IoInformationCircleOutline } from "react-icons/io5";
import { ReactComponent as Logo } from "./../assets/lendasat_svg_logo.svg";
import TypeField from "../components/TypeField";

interface UpgradeToPakeFormProps {
  handleFormSubmission: (
    email: string,
    oldPassword: string,
    contractSecret: string,
    newPassword: string,
  ) => Promise<void>;
}

export function UpgradeToPakeForm({ handleFormSubmission }: UpgradeToPakeFormProps) {
  const [email, setEmail] = useState("");

  const [oldPassword, setOldPassword] = useState("");
  const [isOldPasswordVisible, setIsOldPasswordVisible] = useState(false);

  const [contractSecret, setContractSecret] = useState("");
  const [isContractSecretVisible, setContractSecretVisible] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isNewPasswordVisible, setIsNewPasswordVisible] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    if (newPassword !== confirmNewPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    setError("");
    try {
      await handleFormSubmission(email, oldPassword, contractSecret, newPassword);
    } catch (err) {
      console.error("Failed upgrading user to PAKE:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Upgrade to PAKE failed. Please reach out to support and do not delete your browser storage.",
      );
    }
    setIsLoading(false);
  };

  return (
    <Box className="bg-gradient-to-tr from-60% to-100% from-[#F5F9FD] to-pink-700/5 py-20 pt-0 h-screen overflow-y-scroll flex items-center justify-center dark:from-[#1a202c] dark:to-gray-900/70">
      <Grid align={"center"} className="overflow-hidden grid-cols-1 w-screen">
        <Box className="flex flex-col items-center p-5">
          {/* Logo */}
          <Logo height={27} width={"auto"} className="w-fit invert dark:invert-0" />
          <Box
            mt={"6"}
            maxWidth={"550px"}
            width={"100%"}
            py={"6"}
            px={"6"}
            className="bg-white shadow-sm rounded-2xl dark:bg-dark dark:shadow-md dark:border dark:border-dark"
          >
            {/* Heading */}
            <Box className="text-center pb-4">
              <Heading size={"7"} className="text-font dark:text-font-dark pb-2">Choose a new password</Heading>
              <Text size={"3"} className="text-font/70 dark:text-font-dark/70">
                <strong>Good news!</strong> Lendasat is getting <em>simpler</em>.
              </Text>
              <br /> <br />
              <Text size={"3"} className="text-font/70 dark:text-font-dark/70">
                We have updated the app and you no longer need to remember both a password <em>and</em>{" "}
                a contract secret. You will now use a <strong>single password</strong>{" "}
                to authenticate and secure your wallet.
              </Text>
            </Box>

            {/* Form */}
            <Form className="w-full mt-7 space-y-0.5" onSubmit={onSubmit}>
              <Box className="text-left mt-3">
                {/* Email */}
                <Box>
                  <Text as="label" size={"1"} weight={"medium"} className="text-font/70 dark:text-font-dark/70 mb-2">
                    Email
                  </Text>
                  <TypeField
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Box>
              </Box>

              <Box className="text-left mt-3">
                <Box>
                  <Text as="label" size={"1"} weight={"medium"} className="text-font/70 dark:text-font-dark/70 mb-2">
                    Current Password
                  </Text>
                  <TypeField
                    type={isOldPasswordVisible ? "text" : "password"}
                    placeholder="Current Password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                  >
                    <IconButton
                      variant="ghost"
                      type="button"
                      className="hover:bg-transparent text-font dark:text-font-dark"
                      onClick={() => setIsOldPasswordVisible(!isOldPasswordVisible)}
                    >
                      {isOldPasswordVisible ? <FaRegEye /> : <FaRegEyeSlash />}
                    </IconButton>
                  </TypeField>
                </Box>
              </Box>

              <Box className="text-left mt-3">
                <Box>
                  <Text as="label" size={"1"} weight={"medium"} className="text-font/70 dark:text-font-dark/70 mb-2">
                    Contract Secret
                  </Text>
                  <TypeField
                    type={isContractSecretVisible ? "text" : "password"}
                    placeholder="Enter your contract secret"
                    value={contractSecret}
                    onChange={(e) => setContractSecret(e.target.value)}
                  >
                    <IconButton
                      variant="ghost"
                      type="button"
                      className="hover:bg-transparent text-font dark:text-font-dark"
                      onClick={() => setContractSecretVisible(!isContractSecretVisible)}
                    >
                      {isContractSecretVisible ? <FaRegEye /> : <FaRegEyeSlash />}
                    </IconButton>
                  </TypeField>
                </Box>
              </Box>

              {/* Password */}
              <Box className="grid grid-cols-1 md:grid-cols-2 md:gap-1">
                <Box className="text-left mt-3">
                  <Text as="label" size={"1"} weight={"medium"} className="text-font/70 dark:text-font-dark/70 mb-2">
                    New Password
                  </Text>
                  <TypeField
                    type={isNewPasswordVisible ? "text" : "password"}
                    placeholder="New Password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  >
                    <IconButton
                      type="button"
                      variant="ghost"
                      className="hover:bg-transparent text-font dark:text-font-dark"
                      onClick={() => setIsNewPasswordVisible(!isNewPasswordVisible)}
                      tabIndex={-1}
                    >
                      {isNewPasswordVisible ? <FaRegEye /> : <FaRegEyeSlash />}
                    </IconButton>
                  </TypeField>
                </Box>
                <Box className="text-left mt-3">
                  <Text as="label" size={"1"} weight={"medium"} className="text-font/70 dark:text-font-dark/70 mb-2">
                    Confirm Password
                  </Text>
                  <TypeField
                    type={isNewPasswordVisible ? "text" : "password"}
                    placeholder="Confirm Password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                  >
                    <IconButton
                      type="button"
                      variant="ghost"
                      className="hover:bg-transparent text-font dark:text-font-dark"
                      onClick={() => setIsNewPasswordVisible(!isNewPasswordVisible)}
                      tabIndex={-1}
                    >
                      {isNewPasswordVisible ? <FaRegEye /> : <FaRegEyeSlash />}
                    </IconButton>
                  </TypeField>
                </Box>
              </Box>

              {/* Error message */}
              {error && (
                <Callout.Root color="tomato">
                  <Callout.Icon>
                    <IoInformationCircleOutline />
                  </Callout.Icon>
                  <Callout.Text>
                    {error}
                  </Callout.Text>
                </Callout.Root>
              )}

              {/* Submit Button */}
              <Box className="pt-7">
                <Button
                  color="purple"
                  type="submit"
                  size={"3"}
                  variant="solid"
                  radius="large"
                  disabled={!(email && oldPassword && contractSecret && newPassword
                    && newPassword === confirmNewPassword
                    && !isLoading)}
                  className="w-full h-12"
                >
                  {isLoading ? <Spinner size={"3"} /> : "Submit"}
                </Button>
              </Box>
            </Form>
          </Box>
        </Box>
      </Grid>
    </Box>
  );
}
