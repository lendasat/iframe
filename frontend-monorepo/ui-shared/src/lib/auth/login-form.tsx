import {
  Box,
  Button,
  Callout,
  Checkbox,
  Flex,
  Grid,
  Heading,
  IconButton,
  Spinner,
  Text,
} from "@radix-ui/themes";
import type { FormEvent } from "react";
import { useState } from "react";
import { FaRegEye, FaRegEyeSlash } from "react-icons/fa";
import { IoInformationCircleOutline } from "react-icons/io5";
import { Link } from "react-router-dom";
import { ReactComponent as Logo } from "./../assets/lendasat_svg_logo.svg";
import TypeField from "../components/TypeField";

interface LoginFormProps {
  handleLogin: (email: string, password: string) => Promise<void>;
  registrationLink: string;
  forgotPasswordLink: string;
  initialUserEmail: string;
  initialUserPassword: string;
  infoMessage?: string;
}

export function LoginForm({
  handleLogin,
  registrationLink,
  forgotPasswordLink,
  initialUserEmail,
  initialUserPassword,
  infoMessage,
}: LoginFormProps) {
  const [email, setEmail] = useState(initialUserEmail);
  const [password, setPassword] = useState(initialUserPassword);
  const [error, setError] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      await handleLogin(email, password);
      setLoading(false);
    } catch (err) {
      setLoading(false);
      console.error("Login failed: ", err);
      setError(`Login failed. ${err}`);
    }
  };

  return (
    <Box className="bg-gradient-to-tr from-60% to-100% from-[#F5F9FD] to-pink-700/5 py-20 pt-0 h-screen overflow-y-scroll flex items-center justify-center dark:from-[#1a202c] dark:to-gray-900/70">
      <Grid align={"center"} className="overflow-hidden grid-cols-1 w-screen">
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
            className="bg-white shadow-sm rounded-2xl dark:bg-dark dark:shadow-md"
          >
            {/* Heading */}
            <Box className="text-center pb-4">
              <Heading
                size={"7"}
                className="text-font dark:text-font-dark pb-2"
              >
                Sign In
              </Heading>
              <Text size={"3"} className="text-font/70 dark:text-font-dark/70">
                Welcome back! Please enter your details...
              </Text>
            </Box>

            {/* Info message */}
            {infoMessage && (
              <Callout.Root color="mint">
                <Callout.Icon>
                  <IoInformationCircleOutline />
                </Callout.Icon>
                <Callout.Text>{infoMessage}.</Callout.Text>
              </Callout.Root>
            )}

            <form onSubmit={onSubmit}>
              {/* Fields */}
              <Box className="text-left mt-3">
                <Box>
                  <Text
                    as="label"
                    size={"1"}
                    weight={"medium"}
                    className="text-font/70 dark:text-font-dark/70 mb-2"
                  >
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
                  <Text
                    as="label"
                    size={"1"}
                    weight={"medium"}
                    className="text-font/70 dark:text-font-dark/70 mb-2"
                  >
                    Password
                  </Text>
                  <TypeField
                    type={isVisible ? "text" : "password"}
                    placeholder=""
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  >
                    <IconButton
                      variant="ghost"
                      type="button"
                      className="hover:bg-transparent text-font dark:text-font-dark"
                      onClick={() => setIsVisible(!isVisible)}
                    >
                      {isVisible ? <FaRegEye /> : <FaRegEyeSlash />}
                    </IconButton>
                  </TypeField>
                </Box>
              </Box>

              {/* Remeder and Forget password */}
              <Box className="my-3">
                <Flex align={"center"} justify={"between"}>
                  <Flex align={"center"} gap={"1"}>
                    <Checkbox size="1" color="purple" />
                    <Text
                      as="label"
                      size={"1"}
                      weight={"medium"}
                      className="text-font/70 dark:text-font-dark/70"
                    >
                      Remember me
                    </Text>
                  </Flex>
                  <Link
                    to={forgotPasswordLink}
                    className="text-sm font-medium text-purple-800 hover:text-font dark:text-purple-300 dark:hover:text-font-dark"
                  >
                    Forgot Password
                  </Link>
                </Flex>
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
              <Box className="mt-7">
                <Button
                  color="purple"
                  type="submit"
                  size={"3"}
                  variant="solid"
                  radius="large"
                  disabled={!(email && password && !loading)}
                  className="w-full h-12"
                >
                  {loading ? <Spinner size={"3"} /> : " Sign in"}
                </Button>
              </Box>
            </form>

            {/* Sign Up Routing */}
            <Box className="flex items-center gap-1 justify-center mt-16">
              <Text
                as="label"
                size={"1"}
                weight={"medium"}
                className="text-font/70 dark:text-font-dark/70"
              >
                Don't have an account?
              </Text>
              <Link
                to={registrationLink}
                className="text-sm font-medium text-purple-800 hover:text-font dark:text-purple-300 dark:hover:text-font-dark"
              >
                Sign up
              </Link>
            </Box>
          </Box>
        </Box>
      </Grid>
    </Box>
  );
}

export default LoginForm;
