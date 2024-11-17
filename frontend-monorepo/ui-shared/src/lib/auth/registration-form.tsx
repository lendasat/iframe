import { Box, Button, Callout, Flex, Grid, Heading, IconButton, Spinner, Text } from "@radix-ui/themes";
import { Link as RadixLink } from "@radix-ui/themes/dist/cjs/components/link";
import type { FormEvent } from "react";
import { useState } from "react";
import { Form } from "react-bootstrap";
import { FaInfoCircle, FaRegEye, FaRegEyeSlash } from "react-icons/fa";
import { IoInformationCircleOutline } from "react-icons/io5";
import { RiUserLine } from "react-icons/ri";
import { Link } from "react-router-dom";
import Background from "./../assets/background-art.jpeg";
import Dashboard from "./../assets/background-art.png";
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
            <div className="flex gap-4">
              <Box className="text-left flex-1">
                <Text as="label" size={"1"} weight={"medium"} className="text-font/70 mb-2">Password</Text>
                <TypeField
                  type={isPasswordVisible ? "text" : "password"}
                  placeholder="••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                >
                  <IconButton
                    type="button"
                    variant="ghost"
                    color="gray"
                    className="hover:bg-transparent"
                    onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                  >
                    {isPasswordVisible ? <FaRegEye /> : <FaRegEyeSlash />}
                  </IconButton>
                </TypeField>
              </Box>

              <Box className="text-left flex-1">
                <Text as="label" size={"1"} weight={"medium"} className="text-font/70 mb-2">Confirm Password</Text>
                <TypeField
                  type={isPasswordVisible ? "text" : "password"}
                  placeholder="••••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                >
                  <IconButton
                    type="button"
                    variant="ghost"
                    color="gray"
                    className="hover:bg-transparent"
                    onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                  >
                    {isPasswordVisible ? <FaRegEye /> : <FaRegEyeSlash />}
                  </IconButton>
                </TypeField>
              </Box>
            </div>

            {/* Secret password */}
            <div className="flex gap-4">
              <Box className="text-left flex-1">
                <AbbreviationExplanationInfo
                  header={"Contract Secret"}
                  subHeader={""}
                  description={"The contract secret is your password for all your contracts. It cannot be changed. Make sure to back it up safely. At this time this password cannot be changed. "}
                >
                  <RadixLink
                    href="https://lendasat.notion.site/Frequently-Asked-Questions-100d2f24d4cf800e83bbca7cff3bb707"
                    target="_blank"
                  >
                    <Flex align={"center"} gap={"2"} className="text-font-dark mb-2">
                      <Text as="label" size={"1"} weight={"medium"} className="text-font/70">Contract Secret</Text>
                      <FaInfoCircle />
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
                    color="gray"
                    className="hover:bg-transparent"
                    onClick={() => setIsContractSecretVisible(!isContractSecretVisible)}
                  >
                    {isContractSecretVisible ? <FaRegEye /> : <FaRegEyeSlash />}
                  </IconButton>
                </TypeField>
              </Box>

              <Box className="text-left flex-1">
                <AbbreviationExplanationInfo
                  header={"Contract Secret"}
                  subHeader={""}
                  description={"The contract secret is your password for all your contracts. Make sure to back it up safely. At this time this password cannot be changed."}
                >
                  <RadixLink
                    href="https://lendasat.notion.site/Frequently-Asked-Questions-100d2f24d4cf800e83bbca7cff3bb707"
                    target="_blank"
                  >
                    <Flex align={"center"} gap={"2"} className="text-font-dark mb-2">
                      <Text as="label" size={"1"} weight={"medium"} className="text-font/70">
                        Confirm Contract Secret
                      </Text>
                      <FaInfoCircle />
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
                    color="gray"
                    className="hover:bg-transparent"
                    onClick={() => setIsContractSecretVisible(!isContractSecretVisible)}
                  >
                    {isContractSecretVisible ? <FaRegEye /> : <FaRegEyeSlash />}
                  </IconButton>
                </TypeField>
              </Box>
            </div>

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
