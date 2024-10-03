import { Box, Button, Callout, Grid, Heading, Spinner, Text } from "@radix-ui/themes";
import React, { useState } from "react";
import { Form } from "react-bootstrap";
import { IoArrowBackOutline, IoInformationCircleOutline } from "react-icons/io5";
import { TbFingerprint } from "react-icons/tb";
import { Link } from "react-router-dom";
import Background from "./../assets/forget-password-img.png";
import { ReactComponent as Logo } from "./../assets/lendasat_svg_logo.svg";
import TypeField from "../components/TypeField";

interface ForgotPasswordProps {
  handleSubmit: (email: string) => Promise<string>;
}

export function ForgotPasswordForm({ handleSubmit }: ForgotPasswordProps) {
  const [email, setEmail] = useState("borrower@lendasat.com");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const success = await handleSubmit(email);
      setSuccess(success);
    } catch (err) {
      console.error("Failed resetting password: ", err);
      setError(`Failed resetting password. ${err}`);
    }
    setLoading(false);
  };

  return (
    <Grid className="min-h-screen lg:grid-cols-5 items-center">
      {
        /* <img
        className="absolute z-0 top-0 left-0 h-full w-full mix-blend-overlay opacity-5"
        src={Background}
        alt="Background"
      /> */
      }
      <Box minHeight={"100vh"} className="flex flex-col justify-between py-10 items-center px-6 md:px-10 lg:col-span-2">
        <Box className="flex items-center justify-between w-full">
          {/* Logo */}
          <Logo height={20} width={"auto"} className="w-fit invert " />

          <Link
            to={"/registration"}
            className="text-sm font-medium text-font-dark hover:text-purple-900 underline underline-offset-1"
          >
            Create an account
          </Link>
        </Box>

        <Box className="max-w-xs w-full mx-auto text-center">
          <Box className="mx-auto h-16 w-16 mb-2 rounded-full shadow-black/10 bg-gradient-to-b from-black/5 to-6% to-white/0 border border-font/5 flex items-center justify-center">
            <Box className="h-10 w-10 bg-white rounded-full border border-font/5 flex items-center justify-center">
              <TbFingerprint size={20} className="text-font/50" />
            </Box>
          </Box>

          <Heading size={"7"} mb={"1"} className="text-font-dark font-semibold">
            Forgot password?
          </Heading>

          <Text size={"2"} weight={"medium"} className="text-font/60 text-center">
            Worry not, we'll send you a reset instruction.
          </Text>

          <Form onSubmit={onSubmit} className="w-full mt-7 space-y-2.5">
            {/* Email */}
            <Box className="text-left">
              <Text as="label" size={"1"} weight={"medium"} className="text-font/70 mb-2">Email</Text>
              <TypeField
                placeholder="example@domain.com"
                value={email}
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
              />
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

            {/* Error message */}
            {success && (
              <Callout.Root color="green">
                <Callout.Icon>
                  <IoInformationCircleOutline />
                </Callout.Icon>
                <Callout.Text>
                  {success}
                </Callout.Text>
              </Callout.Root>
            )}

            {/* Submit Button */}
            <Box className="pt-4">
              <Button
                color="purple"
                type="submit"
                size={"3"}
                variant="solid"
                radius="large"
                disabled={email && !isLoading ? false : true}
                className="w-full h-12"
              >
                {isLoading ? <Spinner size={"3"} /> : "Register"}
              </Button>
            </Box>
          </Form>

          {/* Sign Up Routing */}

          <Link to={"/login"} className="text-sm font-medium text-font-dark hover:text-purple-800">
            <Box className="flex items-center gap-1 justify-center mt-6">
              <IoArrowBackOutline />
              <Text size={"2"}>Back to Sign in</Text>
            </Box>
          </Link>
        </Box>

        <Box className="h-10" />
      </Box>
      <Box className="lg:col-span-3 bg-purple-50 h-full flex items-center pl-20 rounded-l-[60px]">
        <img
          src={Background}
          alt="Dashboard Screen"
        />
      </Box>
    </Grid>
  );
}

export default ForgotPasswordForm;
