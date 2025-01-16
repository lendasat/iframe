import { Box, Button, Callout, Grid, Heading, Spinner, Text } from "@radix-ui/themes";
import type { FormEvent } from "react";
import { useState } from "react";
import { Form } from "react-bootstrap";
import { IoArrowBackOutline, IoInformationCircleOutline } from "react-icons/io5";
import { Link } from "react-router-dom";
import { ReactComponent as Logo } from "./../assets/lendasat_svg_logo.svg";
import TypeField from "../components/TypeField";

interface ForgotPasswordProps {
  handleSubmit: (email: string) => Promise<string>;
}

export function ForgotPasswordForm({ handleSubmit }: ForgotPasswordProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const success = await handleSubmit(email);
      setSuccess(success);
    } catch (err) {
      console.error(`Failed resetting password: ${JSON.stringify(err)}`);
      setError(`Failed resetting password. ${JSON.stringify(err)}`);
    }
    setLoading(false);
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
            className="bg-light dark:bg-dark shadow-sm rounded-2xl"
          >
            <Box className="text-center pb-4">
              <Heading size={"7"} className="text-font dark:text-font-dark pb-2">Forgot your password?</Heading>
              <Text size={"3"} className="text-font/70 dark:text-font-dark/70">
                Worry not, we will send you reset instructions.
              </Text>
            </Box>

            <Form className="w-full" onSubmit={onSubmit}>
              {/* Email */}
              <Box className="grid grid-cols-1 gap-1 mb-3">
                <Box className="text-left mt-3">
                  <Text as="label" size={"1"} weight={"medium"} className="text-font/70 dark:text-font-dark/70 mb-2">
                    Email
                  </Text>
                  <TypeField
                    placeholder="example@domain.com"
                    value={email}
                    autoComplete="email"
                    onChange={(e) => setEmail(e.target.value)}
                  />
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
                  disabled={!(email && !isLoading)}
                  className="w-full h-12 "
                >
                  {isLoading ? <Spinner size={"3"} /> : "Submit"}
                </Button>
              </Box>
            </Form>

            {/* Sign Up Routing */}

            <Link
              to={"/login"}
              className="text-sm font-medium text-font dark:text-font-dark hover:text-purple-800 dark:hover:text-purple-300"
            >
              <Box className="flex items-center gap-1 justify-center mt-6">
                <IoArrowBackOutline />
                <Text size={"2"}>Back to Sign in</Text>
              </Box>
            </Link>
          </Box>
        </Box>
      </Grid>
    </Box>
  );
}

export default ForgotPasswordForm;
