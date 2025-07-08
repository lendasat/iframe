import {
  Box,
  Callout,
  Grid,
  Heading,
  Text,
  Link as RadixLink,
} from "@radix-ui/themes";
import { Link } from "react-router-dom";
import { ReactComponent as Logo } from "./../assets/lendasat_svg_logo.svg";
import { InfoCircledIcon } from "@radix-ui/react-icons";

export function WaitlistSuccesPage() {
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
                Thank you for joining the Waitlist!
              </Heading>
            </Box>

            <Heading
              size={"3"}
              className="text-font dark:text-font-dark text-center"
              weight={"light"}
            >
              We will notify you once we are ready to let you in.
            </Heading>

            <Callout.Root color={"blue"} mt={"5"}>
              <Callout.Icon>
                <InfoCircledIcon />
              </Callout.Icon>
              <Callout.Text align={"center"}>
                Meanwhile, please join our discord{" "}
                <RadixLink
                  href={"https://discord.gg/a5MP7yZDpQ"}
                  target={"_blank"}
                >
                  here
                </RadixLink>{" "}
                and follow us on{" "}
                <RadixLink
                  href={"https://https://x.com/lendasat"}
                  target={"_blank"}
                >
                  X.com
                </RadixLink>{" "}
                for updates.
              </Callout.Text>
            </Callout.Root>

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
