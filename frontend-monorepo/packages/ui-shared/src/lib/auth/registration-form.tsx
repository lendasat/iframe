import {
  Box,
  Button,
  Callout,
  Grid,
  Heading,
  IconButton,
  Spinner,
  Text,
} from "@radix-ui/themes";
import type { FormEvent } from "react";
import { useState } from "react";
import { Form } from "react-bootstrap";
import { FaRegEye, FaRegEyeSlash } from "react-icons/fa";
import { IoInformationCircleOutline } from "react-icons/io5";
import { Link } from "react-router-dom";
import { ReactComponent as Logo } from "./../assets/lendasat_svg_logo.svg";
import TypeField from "../components/TypeField";

interface RegistrationFormProps {
  handleRegister: (
    name: string,
    email: string,
    password: string,
    referralCode?: string,
  ) => Promise<void>;
  referralCode: string | null;
}

export function RegistrationForm({
  handleRegister,
  referralCode: defaultReferralCode,
}: RegistrationFormProps) {
  if (
    defaultReferralCode === null &&
    import.meta.env.VITE_BITCOIN_NETWORK === "regtest"
  ) {
    defaultReferralCode = "BETA_PHASE_1";
  }

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [referralCode, setReferralCode] = useState<string>(
    defaultReferralCode || "",
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

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
      await handleRegister(name, email, password, referralCode);
    } catch (err) {
      console.error("Failed registering user:", err);
      setError(err instanceof Error ? err.message : "Registration failed.");
    }
    setIsLoading(false);
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
            className="dark:bg-dark dark:border-dark rounded-2xl bg-white shadow-sm dark:border dark:shadow-md"
          >
            {/* Heading */}
            <Box className="pb-4 text-center">
              <Heading
                size={"7"}
                className="text-font dark:text-font-dark pb-2"
              >
                Register
              </Heading>
              <Text size={"3"} className="text-font/70 dark:text-font-dark/70">
                To join the future of lending
              </Text>
            </Box>

            {/* Form */}
            <Form className="mt-7 w-full space-y-0.5" onSubmit={onSubmit}>
              <Box className="grid grid-cols-1 md:grid-cols-2 md:gap-1">
                <Box className="mt-3 text-left">
                  <Text
                    as="label"
                    size={"1"}
                    weight={"medium"}
                    className="text-font/70 dark:text-font-dark/70 mb-2"
                  >
                    Name
                  </Text>
                  <TypeField
                    placeholder="Satoshi Nakamoto"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Box>

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

              {/* Password */}
              <Box className="grid grid-cols-1 md:grid-cols-2 md:gap-1">
                <Box className="mt-3 text-left">
                  <Text
                    as="label"
                    size={"1"}
                    weight={"medium"}
                    className="text-font/70 dark:text-font-dark/70 mb-2"
                  >
                    Password
                  </Text>
                  <TypeField
                    type={isPasswordVisible ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  >
                    <IconButton
                      type="button"
                      variant="ghost"
                      className="text-font dark:text-font-dark hover:bg-transparent"
                      onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                      tabIndex={-1}
                    >
                      {isPasswordVisible ? <FaRegEye /> : <FaRegEyeSlash />}
                    </IconButton>
                  </TypeField>
                </Box>
                <Box className="mt-3 text-left">
                  <Text
                    as="label"
                    size={"1"}
                    weight={"medium"}
                    className="text-font/70 dark:text-font-dark/70 mb-2"
                  >
                    Confirm Password
                  </Text>
                  <TypeField
                    type={isPasswordVisible ? "text" : "password"}
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  >
                    <IconButton
                      type="button"
                      variant="ghost"
                      className="text-font dark:text-font-dark hover:bg-transparent"
                      onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                      tabIndex={-1}
                    >
                      {isPasswordVisible ? <FaRegEye /> : <FaRegEyeSlash />}
                    </IconButton>
                  </TypeField>
                </Box>
              </Box>

              {/* Referral Code */}
              <Box className="grid grid-cols-1 gap-5">
                <Box className="mt-3 text-left">
                  <Text
                    as="label"
                    size={"1"}
                    weight={"medium"}
                    className="text-font/70 dark:text-font-dark/70 mb-2"
                  >
                    Referral Code
                  </Text>
                  <TypeField
                    placeholder=""
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value)}
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
                  disabled={
                    !(
                      email &&
                      password === confirmPassword &&
                      name &&
                      !isLoading
                    )
                  }
                  className="h-12 w-full"
                >
                  {isLoading ? <Spinner size={"3"} /> : "Register"}
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
          </Box>
        </Box>
      </Grid>
    </Box>
  );
}
