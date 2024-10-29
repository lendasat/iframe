import { Box, Button, Callout, Grid, Heading, IconButton, Spinner, Text } from "@radix-ui/themes";
import type { FormEvent } from "react";
import { useState } from "react";
import { Form } from "react-bootstrap";
import { FaRegEye, FaRegEyeSlash } from "react-icons/fa";
import { IoInformationCircleOutline } from "react-icons/io5";
import { RiUserLine } from "react-icons/ri";
import { Link } from "react-router-dom";
import Background from "./../assets/background-art.jpeg";
import Dashboard from "./../assets/background-art.png";
import { ReactComponent as Logo } from "./../assets/lendasat_svg_logo.svg";
import TypeField from "../components/TypeField";

interface RegistrationFormProps {
  handleRegister: (name: string, email: string, password: string, inviteCode?: string) => Promise<void>;
}

export function RegistrationForm({ handleRegister }: RegistrationFormProps) {
  let defaultInviteCode = "";
  if (import.meta.env.VITE_BITCOIN_NETWORK === "regtest") {
    defaultInviteCode = "IMONFIRE2024";
  }

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [inviteCode, setInviteCode] = useState<string>(defaultInviteCode);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }
    setError("");
    try {
      await handleRegister(name, email, password, inviteCode);
    } catch (err) {
      console.error("Failed registering user:", err);
      setError(err instanceof Error ? err.message : "Registration failed.");
    }
    setIsLoading(false);
  };

  return (
    <Grid className="min-h-screen lg:grid-cols-2">
      <Box className="lg:min-h-screen flex flex-col py-10 lg:py-5 justify-center order-2 lg:order-1">
        <Box className="flex flex-col items-center justify-center px-5 md:px-10 xl:px-16 max-w-2xl mx-auto w-full">
          <Box className="h-16 w-16 mb-2 rounded-full shadow-black/10 bg-gradient-to-b from-black/5 to-6% to-white/0 border border-font/5 flex items-center justify-center">
            <Box className="h-10 w-10 bg-white rounded-full border border-font/5 flex items-center justify-center">
              <RiUserLine className="text-font/50" />
            </Box>
          </Box>

          <Heading weight={"medium"} size={"8"} mb={"2"} className="text-font-dark">
            Join the future of lending
          </Heading>

          {/* Form */}
          <Form className="w-full mt-7 space-y-2.5" onSubmit={onSubmit}>
            <Box className="grid grid-cols-2 gap-5">
              {/* Name */}
              <Box>
                <Text as="label" size={"1"} weight={"medium"} className="text-font/70 mb-2">Name</Text>
                <TypeField
                  placeholder="Satoshi Nakamoto"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Box>

              {/* Email */}
              <Box>
                <Text as="label" size={"1"} weight={"medium"} className="text-font/70 mb-2">Email</Text>
                <TypeField
                  placeholder="example@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Box>
            </Box>

            {/* Password */}
            <Box className="text-left mt-3">
              <Text as="label" size={"1"} weight={"medium"} className="text-font/70 mb-2">Password</Text>
              <TypeField
                type={isVisible ? "text" : "password"}
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              >
                <IconButton
                  type="button"
                  variant="ghost"
                  color="gray"
                  className="hover:bg-transparent"
                  onClick={() => setIsVisible(!isVisible)}
                >
                  {isVisible ? <FaRegEye /> : <FaRegEyeSlash />}
                </IconButton>
              </TypeField>
            </Box>

            {/* Confirm Password */}
            <Box className="text-left mt-3">
              <Box>
                <Text as="label" size={"1"} weight={"medium"} className="text-font/70 mb-2">Confirm Password</Text>
                <TypeField
                  type={isVisible ? "text" : "password"}
                  placeholder="••••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                >
                  <IconButton
                    type="button"
                    variant="ghost"
                    color="gray"
                    className="hover:bg-transparent"
                    onClick={() => setIsVisible(!isVisible)}
                  >
                    {isVisible ? <FaRegEye /> : <FaRegEyeSlash />}
                  </IconButton>
                </TypeField>
              </Box>
            </Box>

            {/* Referral Code */}
            <Box>
              <Text as="label" size={"1"} weight={"medium"} className="text-font/70 mb-2">Referral Code</Text>
              <TypeField
                placeholder=""
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
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

            {/* Submit Button */}
            <Box className="pt-7">
              <Button
                color="purple"
                type="submit"
                size={"3"}
                variant="solid"
                radius="large"
                disabled={!(email && password === confirmPassword && name && !isLoading)}
                className="w-full h-12"
              >
                {isLoading ? <Spinner size={"3"} /> : "Register"}
              </Button>
            </Box>
          </Form>

          {/* Sign Up Routing */}
          <Box className="flex items-center gap-1 justify-center mt-16">
            <Text as="label" size={"1"} weight={"medium"} className="text-font/70">Already have an account?</Text>
            <Link to={"/login"} className="text-sm font-medium text-font-dark hover:text-purple-800">
              Sign in
            </Link>
          </Box>
        </Box>
      </Box>

      <Box className="bg-purple-900 relative flex flex-col items-center justify-center px-12 order-1 py-20 lg:order-2">
        {/* Logo */}
        <Logo height={27} width={"auto"} className="w-fit" />

        {/* Dashboard Preview */}
        <Box className="h-auto mb-7 mt-20 max-w-md relative flex items-center justify-center">
          <img
            className="object-contain object-center h-full w-full"
            src={Dashboard}
            alt="Background"
          />
        </Box>

        {/* Information */}
        <Box maxWidth={"500px"} mx={"auto"} className="text-center text-white">
          <Heading size={"7"} className="xl:text-4xl">
            Kickstart your journey at Lendasat with a few Clicks
          </Heading>
          <Box mt={"3"}>
            <Text size={"3"} weight={"medium"} className="text-white/80">
              Borrow against your Bitcoin in a secure and non-custodial way. Never. Sell. Your. Bitcoin.
            </Text>
          </Box>
        </Box>

        <img
          className="absolute z-0 top-0 left-0 h-full w-full mix-blend-overlay opacity-5"
          src={Background}
          alt="Background"
        />
      </Box>
    </Grid>
  );
}
