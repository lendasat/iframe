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
import { Link } from "react-router-dom";
import { ReactComponent as Logo } from "./../assets/lendasat_svg_logo.svg";
import TypeField from "../components/TypeField";

interface WaitlistFormProps {
  handleRegister: (email: string) => Promise<void>;
}

export function WaitlistForm({ handleRegister }: WaitlistFormProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    setError("");
    try {
      await handleRegister(email);
    } catch (err) {
      console.error("Failed register in waitlist:", err);
      const msg = "Registration failed";
      setError(err instanceof Error ? `${msg}: ${err.message}` : msg);
    }
    setIsLoading(false);
  };

  console.log(`error ${error}`);

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
            className="dark:bg-dark dark:border-dark rounded-2xl bg-white shadow-sm dark:border dark:shadow-md"
          >
            {/* Heading */}
            <Box className="pb-4 text-center">
              <Heading
                size={"7"}
                className="text-font dark:text-font-dark pb-2"
              >
                Join Waitlist
              </Heading>
            </Box>

            <Heading
              size={"3"}
              className="text-font dark:text-font-dark text-center"
              weight={"light"}
            >
              Share your email with us and we will let you know once there's
              space for you.
            </Heading>

            {/* Form */}
            <Form className="mt-7 w-full space-y-0.5" onSubmit={onSubmit}>
              <Box>
                {/* Email */}
                <Box className="mt-3 text-left">
                  <Text
                    as="label"
                    size={"1"}
                    weight={"medium"}
                    className="text-font/70 dark:text-font-dark/70 mb-2"
                  >
                    Email
                  </Text>
                  <TypeField
                    placeholder="example@domain.com"
                    value={email}
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
                  <Callout.Text>{error}</Callout.Text>
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
                  disabled={!(email && !isLoading)}
                  className="h-12 w-full"
                >
                  {isLoading ? <Spinner size={"3"} /> : "Join"}
                </Button>
              </Box>
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
                className="hover:text-font dark:hover:text-font-dark text-sm font-medium text-purple-800 dark:text-purple-300"
              >
                Sign in
              </Link>
            </Box>
            <Box className="flex items-center justify-center gap-1">
              <Text
                as="label"
                size={"1"}
                weight={"medium"}
                className="text-font/70 dark:text-font-dark/70"
              >
                Do you have an invite code?
              </Text>
              <Link
                to={"/registration"}
                className="hover:text-font dark:hover:text-font-dark text-sm font-medium text-purple-800 dark:text-purple-300"
              >
                Register here
              </Link>
            </Box>
          </Box>
        </Box>
      </Grid>
    </Box>
  );
}
