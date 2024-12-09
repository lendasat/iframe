import { Box, Button, Callout, Flex, Grid, Heading, IconButton, Spinner, Text } from "@radix-ui/themes";
import { Link as RadixLink } from "@radix-ui/themes/dist/cjs/components/link";
import type { FormEvent } from "react";
import { useState } from "react";
import { Form } from "react-bootstrap";
import { FaInfoCircle, FaRegEye, FaRegEyeSlash } from "react-icons/fa";
import { IoInformationCircleOutline } from "react-icons/io5";
import { Link } from "react-router-dom";
import { ReactComponent as Logo } from "./../assets/lendasat_svg_logo.svg";
import AbbreviationExplanationInfo from "../components/abbreviation-explanation-info";
import TypeField from "../components/TypeField";

interface RegistrationFormProps {
  handleRegister: (
    name: string,
    email: string,
    password: string,
    contractSecret: string,
    inviteCode?: string,
  ) => Promise<void>;
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
  const [contractSecret, setContractSecret] = useState("");
  const [confirmContractSecret, setConfirmContractSecret] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isContractSecretVisible, setIsContractSecretVisible] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }
    if (contractSecret !== confirmContractSecret) {
      setError("Contract secrets do not match");
      setIsLoading(false);
      return;
    }

    setError("");
    try {
      await handleRegister(name, email, password, contractSecret, inviteCode);
    } catch (err) {
      console.error("Failed registering user:", err);
      setError(err instanceof Error ? err.message : "Registration failed.");
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
              <Heading size={"7"} className="text-font dark:text-font-dark pb-2">Register</Heading>
              <Text size={"3"} className="text-font/70 dark:text-font-dark/70">To join the future of lending</Text>
            </Box>

            {/* Form */}
            <Form className="w-full mt-7 space-y-0.5" onSubmit={onSubmit}>
              <Box className="grid grid-cols-1 md:grid-cols-2 md:gap-1">
                <Box className="text-left mt-3">
                  <Text as="label" size={"1"} weight={"medium"} className="text-font/70 dark:text-font-dark/70 mb-2">
                    Name
                  </Text>
                  <TypeField
                    placeholder="Satoshi Nakamoto"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Box>

                {/* Email */}
                <Box className="text-left mt-3">
                  <Text as="label" size={"1"} weight={"medium"} className="text-font/70 dark:text-font-dark/70 mb-2">
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
                <Box className="text-left mt-3">
                  <Text as="label" size={"1"} weight={"medium"} className="text-font/70 dark:text-font-dark/70 mb-2">
                    Password
                  </Text>
                  <TypeField
                    type={isPasswordVisible ? "text" : "password"}
                    placeholder="••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  >
                    <IconButton
                      type="button"
                      variant="ghost"
                      className="hover:bg-transparent text-font dark:text-font-dark"
                      onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                      tabIndex={-1}
                    >
                      {isPasswordVisible ? <FaRegEye /> : <FaRegEyeSlash />}
                    </IconButton>
                  </TypeField>
                </Box>
                <Box className="text-left mt-3">
                  <Text as="label" size={"1"} weight={"medium"} className="text-font/70 dark:text-font-dark/70 mb-2">
                    Confirm Password
                  </Text>
                  <TypeField
                    type={isPasswordVisible ? "text" : "password"}
                    placeholder="••••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  >
                    <IconButton
                      type="button"
                      variant="ghost"
                      className="hover:bg-transparent text-font dark:text-font-dark"
                      onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                      tabIndex={-1}
                    >
                      {isPasswordVisible ? <FaRegEye /> : <FaRegEyeSlash />}
                    </IconButton>
                  </TypeField>
                </Box>
              </Box>

              {/* Secret password */}

              <Box className="grid grid-cols-1 md:grid-cols-2 md:gap-1">
                <Box className="text-left mt-3">
                  <AbbreviationExplanationInfo
                    header={"Contract Secret"}
                    subHeader={""}
                    description={"The contract secret is your password for all your contracts. It cannot be changed. Make sure to back it up safely. At this time this password cannot be changed. "}
                  >
                    <RadixLink
                      href="https://lendasat.notion.site/Frequently-Asked-Questions-100d2f24d4cf800e83bbca7cff3bb707"
                      target="_blank"
                      tabIndex={-1}
                    >
                      <Flex align={"center"} gap={"2"} className="text-font dark:text-font-dark mb-2">
                        <Text
                          as="label"
                          size={"1"}
                          weight={"medium"}
                          className="text-font/70 dark:text-font-dark/70 mb-2"
                        >
                          Contract Secret
                        </Text>
                        <FaInfoCircle className="text-font/70 dark:text-font-dark/70 mb-2" />
                      </Flex>
                    </RadixLink>
                  </AbbreviationExplanationInfo>
                  <TypeField
                    type={isContractSecretVisible ? "text" : "password"}
                    placeholder="••••••••••"
                    value={contractSecret}
                    onChange={(e) => setContractSecret(e.target.value)}
                  >
                    <IconButton
                      type="button"
                      variant="ghost"
                      className="hover:bg-transparent text-font dark:text-font-dark"
                      onClick={() => setIsContractSecretVisible(!isContractSecretVisible)}
                      tabIndex={-1}
                    >
                      {isContractSecretVisible ? <FaRegEye /> : <FaRegEyeSlash />}
                    </IconButton>
                  </TypeField>
                </Box>

                <Box className="text-left mt-3">
                  <AbbreviationExplanationInfo
                    header={"Contract Secret"}
                    subHeader={""}
                    description={"The contract secret is your password for all your contracts. It cannot be changed. Make sure to back it up safely. At this time this password cannot be changed. "}
                  >
                    <RadixLink
                      href="https://lendasat.notion.site/Frequently-Asked-Questions-100d2f24d4cf800e83bbca7cff3bb707"
                      target="_blank"
                      tabIndex={-1}
                    >
                      <Flex align={"center"} gap={"2"} className="text-font dark:text-font-dark mb-2">
                        <Text
                          as="label"
                          size={"1"}
                          weight={"medium"}
                          className="text-font/70 dark:text-font-dark/70 mb-2"
                        >
                          Confirm Contract Secret
                        </Text>
                        <FaInfoCircle className="text-font/70 dark:text-font-dark/70 mb-2" />
                      </Flex>
                    </RadixLink>
                  </AbbreviationExplanationInfo>
                  <TypeField
                    type={isContractSecretVisible ? "text" : "password"}
                    placeholder="••••••••••"
                    value={confirmContractSecret}
                    onChange={(e) => setConfirmContractSecret(e.target.value)}
                  >
                    <IconButton
                      type="button"
                      variant="ghost"
                      className="hover:bg-transparent text-font dark:text-font-dark"
                      onClick={() => setIsContractSecretVisible(!isContractSecretVisible)}
                      tabIndex={-1}
                    >
                      {isContractSecretVisible ? <FaRegEye /> : <FaRegEyeSlash />}
                    </IconButton>
                  </TypeField>
                </Box>
              </Box>

              {/* Referral Code */}
              <Box className="grid grid-cols-1 gap-5">
                <Box className="text-left mt-3">
                  <Text as="label" size={"1"} weight={"medium"} className="text-font/70 dark:text-font-dark/70 mb-2">
                    Referral Code
                  </Text>
                  <TypeField
                    placeholder=""
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
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
              <Text as="label" size={"1"} weight={"medium"} className="text-font/70 dark:text-font-dark/70">
                Already have an account?
              </Text>
              <Link
                to={"/login"}
                className="text-sm font-medium text-purple-800 hover:text-font dark:text-purple-300 dark:hover:text-font-dark"
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
