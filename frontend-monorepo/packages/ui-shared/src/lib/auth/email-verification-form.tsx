import {
  Box,
  Button,
  Callout,
  Grid,
  Heading,
  Spinner,
  Text,
} from "@radix-ui/themes";
import type { FormEvent } from "react";
import { useState } from "react";
import { Form } from "react-bootstrap";
import { IoInformationCircleOutline } from "react-icons/io5";
import { Link, useNavigate } from "react-router-dom";
import { ReactComponent as Logo } from "./../assets/lendasat_svg_logo.svg";
import TypeField from "../components/TypeField";

interface EmailVerificationFormProps {
  handleVerification: (verificationCode: string) => Promise<void>;
  initialVerificationCode: string;
}

export function EmailVerificationForm({
  handleVerification,
  initialVerificationCode,
}: EmailVerificationFormProps) {
  const navigate = useNavigate();
  const [verificationCode, setVerificationCode] = useState(
    initialVerificationCode,
  );
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      await handleVerification(verificationCode);
    } catch (err) {
      console.error("Failed to verify email:", err);
      setError(
        err instanceof Error ? err.message : "Verification failed failed.",
      );
    } finally {
      setIsLoading(false);
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
            {/* Heading */}
            <Box className="pb-4 text-center">
              <Heading
                size={"7"}
                className="text-font dark:text-font-dark pb-2"
              >
                Verify Email
              </Heading>
              <Text size={"3"} className="text-font/70 dark:text-font-dark/70">
                Check your email for the verification code
              </Text>
            </Box>

            {/* Form */}
            <Form className="mt-7 w-full space-y-0.5" onSubmit={onSubmit}>
              <Box className="mt-3 text-left">
                <TypeField
                  placeholder="000000"
                  value={verificationCode}
                  maxLength={6}
                  className="text-font dark:text-font-dark bg-light dark:bg-dark w-full text-center text-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onChange={(e) => setVerificationCode(e.target.value)}
                />
              </Box>

              {/* Error message */}
              {error && (
                <Callout.Root color="tomato">
                  <Callout.Icon>
                    <IoInformationCircleOutline />
                  </Callout.Icon>
                  <Callout.Text>{error}</Callout.Text>
                </Callout.Root>
              )}

              {/* Submit Button */}
              <div className="flex flex-col items-center justify-center gap-4">
                <Box className="w-full pt-7">
                  <Button
                    color="purple"
                    type="submit"
                    size={"3"}
                    variant="solid"
                    radius="large"
                    disabled={isLoading}
                    className="h-12 w-full"
                  >
                    {isLoading ? <Spinner size={"3"} /> : "Continue"}
                  </Button>
                </Box>

                <span
                  onClick={() => navigate("/registration")}
                  className="cursor-pointer text-blue-500 underline hover:text-blue-700"
                  role="link"
                  tabIndex={0}
                >
                  Go Back
                </span>
              </div>
            </Form>

            {/* Sign Up Routing */}
            <Box className="mt-16 flex items-center justify-center gap-1">
              <Text
                as="label"
                size={"1"}
                weight={"medium"}
                className="text-font/70 dark:text-font-dark/70"
              >
                Already have an account?
              </Text>
              <Link
                to={"/login"}
                className="text-font dark:text-font-dark text-sm font-medium hover:text-purple-800 dark:hover:text-purple-300"
              >
                Sign in
              </Link>
            </Box>
          </Box>
        </Box>
      </Grid>
    </Box>
  );
}
