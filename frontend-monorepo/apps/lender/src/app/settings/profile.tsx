import { useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Callout,
  Flex,
  Heading,
  Spinner,
  Text,
} from "@radix-ui/themes";
import { GoVerified } from "react-icons/go";
import { MdEdit } from "react-icons/md";
import { BiSolidError } from "react-icons/bi";
import { IoIosUnlock } from "react-icons/io";
import { useAuth, useLenderHttpClient } from "@frontend/http-client-lender";
import { EditableTimezoneField } from "@frontend/ui-shared";

export function Profile() {
  const { user } = useAuth();
  const { forgotPassword } = useLenderHttpClient();
  const { putUpdateProfile } = useLenderHttpClient();
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

  if (!user) {
    return <>This should not happen</>;
  }

  const options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    year: "numeric",
    month: "long",
    day: "numeric",
  };

  return (
    <Box className="md:pl-8">
      <Box mt={"6"} className="space-y-4">
        <Box
          p={"4"}
          className="rounded-2xl border border-purple-400/20 dark:border-gray-500/50"
        >
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
                className="text-font dark:text-font-dark capitalize"
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
                  <Text size={"1"} weight={"medium"} color="green">
                    Verified
                  </Text>
                </Flex>
              )}
            </Flex>
          </Flex>
        </Box>

        <Box className="rounded-2xl border border-purple-400/20 px-5 py-6 dark:border-gray-500/50">
          <Heading
            as="h4"
            className="text-font dark:text-font-dark font-semibold capitalize"
            size={"3"}
          >
            Personal information
          </Heading>
          <Box mt={"4"} className="grid max-w-lg gap-5 md:grid-cols-2">
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
                <Text
                  size={"3"}
                  weight={"medium"}
                  className="text-font dark:text-font-dark capitalize"
                >
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
                <Text
                  size={"3"}
                  weight={"medium"}
                  className="text-font dark:text-font-dark"
                >
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
                <Flex gap={"3"}>
                  <Text
                    size={"3"}
                    weight={"medium"}
                    className="text-font dark:text-font-dark capitalize"
                  >
                    ********
                  </Text>
                  <Button
                    size={"1"}
                    onClick={handleResetPassword}
                    disabled={isLoading}
                    className="bg-btn text-sm dark:bg-gray-900"
                  >
                    {isLoading ? <Spinner size={"1"} /> : <MdEdit />}
                  </Button>
                </Flex>
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
                <Text
                  size={"3"}
                  weight={"medium"}
                  className="text-font dark:text-font-dark capitalize"
                >
                  {new Date(user.created_at).toLocaleDateString(
                    "en-CA",
                    options,
                  )}
                </Text>
              </Flex>
            </Box>
          </Box>
        </Box>
        {error && (
          <Callout.Root color="red">
            <Callout.Icon>
              <BiSolidError />
            </Callout.Icon>
            <Callout.Text>{error}</Callout.Text>
          </Callout.Root>
        )}

        {success && (
          <Callout.Root color="green">
            <Callout.Icon>
              <IoIosUnlock />
            </Callout.Icon>
            <Callout.Text>{success}</Callout.Text>
          </Callout.Root>
        )}
      </Box>
    </Box>
  );
}
