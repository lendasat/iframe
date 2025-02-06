import { useBaseHttpClient } from "@frontend-monorepo/base-http-client";
import { useAuth, useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import { EditableTimezoneField } from "@frontend-monorepo/ui-shared";
import { Avatar, Badge, Box, Button, Callout, Flex, Heading, Spinner, Text } from "@radix-ui/themes";
import { useState } from "react";
import { BiSolidError } from "react-icons/bi";
import { GoVerified } from "react-icons/go";
import { IoIosUnlock } from "react-icons/io";
import { MdEdit } from "react-icons/md";
import { ReferralCodesTable } from "./referral-codes";

export function Profile() {
  const { user } = useAuth();
  const { forgotPassword } = useBaseHttpClient();
  const { putUpdateProfile } = useBorrowerHttpClient();
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleResetPassword = async () => {
    setLoading(true);
    try {
      const successMsg = await forgotPassword(user?.email ?? "");
      setSuccess(successMsg);
    } catch (err) {
      console.error("Failed resetting password: ", err);
      setError(`Failed resetting password. ${err}`);
    }
    setLoading(false);
  };

  let discountRate = 0.00;
  if (user?.first_time_discount_rate) {
    discountRate = user.first_time_discount_rate;
  }

  if (!user) {
    return <>This should not happen</>;
  }

  // Format date options
  const options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    year: "numeric",
    month: "long",
    day: "numeric",
  };

  return (
    <Box className="md:pl-8">
      <Heading as="h4" className="font-semibold text-font dark:text-font-dark" size={"5"}>
        Profile
      </Heading>
      <Box mt={"6"} className="space-y-4">
        <Box p={"4"} className="border border-purple-400/20 rounded-2xl dark:border-gray-500/50">
          <Flex align={"center"} gap={"3"}>
            <Avatar
              src="https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?&w=256&h=256&q=70&crop=focalpoint&fp-x=0.5&fp-y=0.3&fp-z=1&fit=crop"
              size={"7"}
              radius="full"
              color="purple"
              fallback={user.name.substring(0, 1)}
            />
            <Flex align={"start"} direction={"column"} gap={"1"}>
              <Heading
                as="h4"
                weight={"medium"}
                className="text-font dark:text-font-dark"
                size={"4"}
              >
                {user.name}
              </Heading>
              <Text size={"2"} className="text-font/50 dark:text-font-dark/50">
                {new Date(user.created_at).toLocaleDateString("en-CA", options)}
              </Text>
              {user.verified && (
                <Flex gap={"1"}>
                  <GoVerified color="green" />
                  <Text size={"1"} weight={"medium"} color="green">Verified</Text>
                </Flex>
              )}
            </Flex>
          </Flex>
        </Box>

        <Box className="border border-purple-400/20 rounded-2xl px-5 py-6 dark:border-gray-500/50">
          <Heading
            as="h4"
            className="font-semibold text-font dark:text-font-dark"
            size={"3"}
          >
            Personal information
          </Heading>
          <Box mt={"4"} className="max-w-lg grid md:grid-cols-2 gap-5">
            <Box>
              <Flex direction={"column"} gap={"1"}>
                <Text
                  as="label"
                  weight={"medium"}
                  size={"2"}
                  className="text-font/50 dark:text-font-dark/50"
                >
                  Full Name
                </Text>
                <Text size={"3"} weight={"medium"} className="text-font dark:text-font-dark">
                  {user.name}
                </Text>
              </Flex>
            </Box>

            <Box>
              <Flex direction={"column"} gap={"1"}>
                <Text
                  as="label"
                  weight={"medium"}
                  size={"2"}
                  className="text-font/50 dark:text-font-dark/50"
                >
                  Email Address
                </Text>
                <Text size={"3"} weight={"medium"} className="text-font dark:text-font-dark">
                  {user.email}
                </Text>
              </Flex>
            </Box>
            <Box>
              <Flex direction={"column"} gap={"1"}>
                <Text
                  as="label"
                  weight={"medium"}
                  size={"2"}
                  className="text-font/50 dark:text-font-dark/50"
                >
                  Password
                </Text>
                <Text size={"3"} weight={"medium"} className="text-font dark:text-font-dark">
                  ********
                </Text>
              </Flex>
            </Box>
            <Box>
              <Flex direction={"column"} gap={"1"}>
                <Text
                  as="label"
                  weight={"medium"}
                  size={"2"}
                  className="text-font/50 dark:text-font-dark/50"
                >
                  Timezone
                </Text>
                <EditableTimezoneField
                  onSave={async (newVal) => {
                    await putUpdateProfile({
                      timezone: newVal,
                    });
                  }}
                  initialValue={user.timezone}
                />
              </Flex>
            </Box>
            <Box>
              <Flex direction={"column"} gap={"1"}>
                <Text
                  as="label"
                  weight={"medium"}
                  size={"2"}
                  className="text-font/50 dark:text-font-dark/50"
                >
                  Joined on
                </Text>
                <Text size={"3"} weight={"medium"} className="text-font dark:text-font-dark">
                  {new Date(user.created_at).toLocaleDateString("en-CA", options)}
                </Text>
              </Flex>
            </Box>
            <Box>
              <Flex direction={"column"} gap={"1"}>
                <Text
                  as="label"
                  weight={"medium"}
                  size={"2"}
                  className="text-font/50 dark:text-font-dark/50"
                >
                  Used referral code
                </Text>
                <Text size={"3"} weight={"medium"} className="text-font dark:text-font-dark">
                  <Badge size={"3"}>
                    {user.used_referral_code || "None"}
                  </Badge>
                </Text>
              </Flex>
            </Box>

            <Box>
              <Flex direction={"column"} gap={"1"}>
                <Text
                  as="label"
                  weight={"medium"}
                  size={"2"}
                  className="text-font/50 dark:text-font-dark/50"
                >
                  Current discount on origination fee
                </Text>
                <Text size={"3"} weight={"medium"} className="text-font dark:text-font-dark">
                  {(-discountRate * 100).toFixed(2)}%
                </Text>
              </Flex>
            </Box>
          </Box>
        </Box>
        <Box className="border border-purple-400/20 rounded-2xl px-5 py-6 dark:border-gray-500/50">
          <Heading
            as="h4"
            className="font-semibold text-font dark:text-font-dark"
            size={"3"}
          >
            Personal referral codes
          </Heading>

          <Flex direction={"column"} gap={"1"} className={"mt-5"}>
            {user.personal_referral_codes && <ReferralCodesTable referralCodes={user.personal_referral_codes} />}
            {!user.personal_referral_codes || user.personal_referral_codes?.length === 0
                && (
                  <Callout.Root color="orange">
                    <Callout.Icon>
                      <BiSolidError />
                    </Callout.Icon>
                    <Callout.Text>
                      {"You don't have a personal referral code yet. Reach out to us if you want to take part in the affiliation program"}
                    </Callout.Text>
                  </Callout.Root>
                )}
          </Flex>
        </Box>
        {error && (
          <Callout.Root color="red">
            <Callout.Icon>
              <BiSolidError />
            </Callout.Icon>
            <Callout.Text>
              {error}
            </Callout.Text>
          </Callout.Root>
        )}

        {success
          && (
            <Callout.Root color="green">
              <Callout.Icon>
                <IoIosUnlock />
              </Callout.Icon>
              <Callout.Text>
                {success}
              </Callout.Text>
            </Callout.Root>
          )}

        <Box className="md:pt-5">
          <Flex justify={"end"}>
            <Button
              size={"3"}
              onClick={handleResetPassword}
              disabled={isLoading}
              className="bg-btn text-sm dark:bg-gray-900"
            >
              {isLoading
                ? <Spinner size={"3"} />
                : <MdEdit />}
              Recover Password
            </Button>
          </Flex>
        </Box>
      </Box>
    </Box>
  );
}
