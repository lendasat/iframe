import { Box, Button, Callout, Checkbox, Flex, Grid, Heading, IconButton, Spinner, Text } from "@radix-ui/themes";
import React, { useState } from "react";
import { FaRegEye, FaRegEyeSlash } from "react-icons/fa";
import { IoInformationCircleOutline } from "react-icons/io5";
import { Link } from "react-router-dom";
import Background from "./../assets/background-art.jpeg";
import Dashboard from "./../assets/background-art.png";
import { ReactComponent as Logo } from "./../assets/lendasat_svg_logo.svg";
import { InputField } from "../components/InputField";

interface LoginFormProps {
  handleLogin: (email: string, password: string) => Promise<void>;
  registrationLink: string;
  forgotPasswordLink: string;
  initialUserEmail: string;
  initialUserPassword: string;
  infoMessage?: string;
}

export function LoginForm(
  { handleLogin, registrationLink, forgotPasswordLink, initialUserEmail, initialUserPassword, infoMessage }:
    LoginFormProps,
) {
  const [email, setEmail] = useState(initialUserEmail);
  const [password, setPassword] = useState(initialUserPassword);
  const [error, setError] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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
    <Box className="bg-gradient-to-tr from-60% to-100% from-[#F5F9FD] to-pink-700/5 py-10 lg:pt-48 xl:py-0 h-screen overflow-y-scroll flex items-center justify-center">
      <Grid align={"center"} className="overflow-hidden xl:grid-cols-2 w-screen">
        <Box className="flex flex-col items-center p-5 md:p-10 lg:p-16">
          {/* Logo */}
          <Logo height={27} width={"auto"} className="w-fit invert" />
          <Box mt={"6"} maxWidth={"550px"} width={"100%"} py={"6"} px={"6"} className="bg-white shadow-sm rounded-2xl">
            {/* Heading */}
            <Box className="text-center pb-4">
              <Heading size={"7"} className="text-font-dark pb-2">Sign In</Heading>
              <Text size={"3"} className="text-font/70">Welcome back! Please enter your details...</Text>
            </Box>

            {/* Info message */}
            {infoMessage && (
              <Callout.Root color="mint">
                <Callout.Icon>
                  <IoInformationCircleOutline />
                </Callout.Icon>
                <Callout.Text>
                  {infoMessage}.
                </Callout.Text>
              </Callout.Root>
            )}

            <form onSubmit={onSubmit}>
              {/* Fields */}
              <Box className="text-left mt-3">
                <Box>
                  <Text as="label" size={"1"} weight={"medium"} className="text-font/70 mb-2">Email</Text>
                  <InputField
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Box>
              </Box>
              <Box className="text-left mt-3">
                <Box>
                  <Text as="label" size={"1"} weight={"medium"} className="text-font/70 mb-2">Password</Text>
                  <InputField
                    type={isVisible ? "text" : "password"}
                    placeholder="••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  >
                    <IconButton
                      variant="ghost"
                      color="gray"
                      className="hover:bg-transparent"
                      onClick={() => setIsVisible(!isVisible)}
                    >
                      {isVisible ? <FaRegEye /> : <FaRegEyeSlash />}
                    </IconButton>
                  </InputField>
                </Box>
              </Box>

              {/* Remeder and Forget password */}
              <Box className="my-3">
                <Flex align={"center"} justify={"between"}>
                  <Flex align={"center"} gap={"1"}>
                    <Checkbox size="1" color="purple" />
                    <Text as="label" size={"1"} weight={"medium"} className="text-font/70">Remeber me</Text>
                  </Flex>
                  <Link to={forgotPasswordLink} className="text-sm font-medium text-purple-800 hover:text-font-dark">
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
                  <Callout.Text>
                    {error}
                  </Callout.Text>
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
                  disabled={email && password && !loading ? false : true}
                  className="w-full h-12"
                >
                  {loading ? <Spinner size={"3"} /> : " Sign in"}
                </Button>
              </Box>
            </form>

            {/* Sign Up Routing */}
            <Box className="flex items-center gap-1 justify-center mt-16">
              <Text as="label" size={"1"} weight={"medium"} className="text-font/70">Don't have an account?</Text>
              <Link to={registrationLink} className="text-sm font-medium text-font-dark hover:text-purple-800">
                Sign up
              </Link>
            </Box>
          </Box>
        </Box>

        <Box width={"100%"} height={"100vh"} py={"6"} pr={"6"} className="hidden xl:block">
          <Box className="bg-purple-800 w-full h-full rounded-3xl relative z-10 overflow-hidden pt-20 px-10 text-center pb-10">
            <Heading className="text-white text-4xl xl:text-5xl 2xl:text-6xl font-semibold">
              <Text className="relative after:absolute after:bottom-0 after:h-0.5 after:w-full after:bg-white after:left-0">
                Lendasat
              </Text>
              {" "}
            </Heading>
            <Box mt={"6"} maxWidth={"500px"} mx={"auto"}>
              <Text size={"4"} weight={"medium"} className="text-white">
                Borrow against your Bitcoin in a secure and non-custodial way. Never. Sell. Your. Bitcoin.
              </Text>
            </Box>

            <Box className="h-3/5 w-full mt-10 relative flex items-center justify-center">
              <img
                className="object-contain object-center h-full w-full"
                src={Dashboard}
                alt="Background"
              />
            </Box>
            <img
              className="absolute z-0 top-0 left-0 h-full w-full mix-blend-overlay opacity-5"
              src={Background}
              alt="Background"
            />
          </Box>
        </Box>
      </Grid>
    </Box>
  );
}

export default LoginForm;
