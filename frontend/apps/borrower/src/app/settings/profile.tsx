import { useState } from "react";
import { useAuth, useHttpClientBorrower } from "@frontend/http-client-borrower";
import { EditableTimezoneField, i18n } from "@frontend/ui-shared";
import {
  Card,
  CardHeader,
  CardContent,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Alert,
  AlertDescription,
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@frontend/shadcn";
import { ReferralCodesTable } from "./referral-codes";
import { format } from "date-fns";
import { LuCircleAlert, LuLoader, LuPencil, LuCopy } from "react-icons/lu";
import { toast } from "sonner";

export function Profile() {
  const { user, refreshUser } = useAuth();
  const { forgotPassword, putUpdateProfile, putUpdateLocale } =
    useHttpClientBorrower();
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleCopyUserId = async () => {
    if (user?.id) {
      try {
        await navigator.clipboard.writeText(user.id);
        toast.success("User ID copied to clipboard!");
      } catch (err) {
        console.error("Failed to copy user ID:", err);
        toast.error("Failed to copy user ID");
      }
    }
  };

  const handleResetPassword = async () => {
    setLoading(true);
    try {
      const successMsg = await forgotPassword(user?.email ?? "");
      toast.success(successMsg, {
        description: format(new Date(), "MMM, dd yyyy - p"),
      });
    } catch (err) {
      console.error("Failed resetting password: ", err);
      setError(`Failed resetting password. ${err}`);
    }
    setLoading(false);
  };

  let discountRate = 0.0;
  if (user?.first_time_discount_rate) {
    discountRate = user.first_time_discount_rate;
  }

  if (!user) {
    return <>This should not happen</>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card className="shadow-sm">
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage
                src="https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?&w=256&h=256&q=70&crop=focalpoint&fp-x=0.5&fp-y=0.3&fp-z=1&fit=crop"
                alt={user.name}
              />
              <AvatarFallback>{user.name.substring(0, 1)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-0.5">
              <h4 className="text-base font-medium">{user.name}</h4>
              <div className="flex items-center gap-2">
                <p className="text-xs font-mono text-gray-400">ID: {user.id}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopyUserId}
                  className="h-4 w-4 p-0 hover:bg-gray-100"
                  title="Copy User ID"
                >
                  <LuCopy size={10} />
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                {format(user.created_at, "MMM, dd yyyy - p")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="px-4 pb-1 pt-3">
          <h4 className="text-sm font-semibold">Personal information</h4>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-0.5">
              <div className="text-xs font-medium text-gray-500">Username</div>
              <p className="text-sm font-medium">{user.name}</p>
            </div>

            <div className="flex flex-col gap-0.5">
              <div className="text-xs font-medium text-gray-500">
                Email Address
              </div>
              <p className="text-sm font-medium">{user.email}</p>
            </div>

            <div className="flex flex-col gap-0.5">
              <div className="text-xs font-medium text-gray-500">Password</div>
              <div className="flex flex-row justify-between">
                <p className="text-sm font-medium">********</p>
                <Button
                  onClick={handleResetPassword}
                  variant={"ghost"}
                  disabled={isLoading}
                  size={"icon"}
                >
                  {isLoading ? (
                    <LuLoader className="animate-spin" />
                  ) : (
                    <LuPencil className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-0.5">
              <div className="text-xs font-medium text-gray-500">Timezone</div>
              <EditableTimezoneField
                onSave={async (newVal) => {
                  await putUpdateProfile({
                    timezone: newVal,
                  });
                }}
                initialValue={user.timezone}
              />
            </div>

            <div className="flex flex-col gap-0.5">
              <div className="text-xs font-medium text-gray-500">
                Preferred Language
              </div>
              <Select
                value={user.locale || "system"}
                onValueChange={async (value) => {
                  const locale = value === "system" ? undefined : value;
                  try {
                    setError("");
                    await putUpdateLocale(locale);
                    await refreshUser();
                    await i18n.changeLanguage(locale);
                    setSuccess("Language updated successfully!");
                    setTimeout(() => setSuccess(""), 3000);
                  } catch (err) {
                    console.error("Failed updating locale: ", err);
                    setError(`Failed updating language. ${err}`);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">System Default</SelectItem>
                  <SelectItem value="en-US">English (US)</SelectItem>
                  <SelectItem value="de-DE">Deutsch</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-0.5">
              <div className="text-xs font-medium text-gray-500">Joined on</div>
              <p className="text-sm font-medium">
                {format(user.created_at, "MMM, dd yyyy - p")}
              </p>
            </div>

            <div className="flex flex-col gap-0.5">
              <div className="text-xs font-medium text-gray-500">
                Used referral code
              </div>
              <Badge variant="outline">
                {user.used_referral_code || "None"}
              </Badge>
            </div>

            <div className="flex flex-col gap-0.5">
              <div className="text-xs font-medium text-gray-500">
                Current discount on origination fee
              </div>
              <p className="text-sm font-medium">
                {(-discountRate * 100).toFixed(2)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="pb-24 shadow-sm">
        <CardHeader className="px-4 pb-1 pt-3">
          <h4 className="text-sm font-semibold">Personal referral codes</h4>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          {user.personal_referral_codes && (
            <ReferralCodesTable referralCodes={user.personal_referral_codes} />
          )}

          {!user.personal_referral_codes ||
            (user.personal_referral_codes?.length === 0 && (
              <Alert variant="warning" className="text-sm">
                <LuCircleAlert className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  You don't have a personal referral code yet. Please contact us
                  if you're interested in joining our affiliate program.
                </AlertDescription>
              </Alert>
            ))}
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" className="my-4 text-sm">
          <LuCircleAlert className="h-4 w-4" />
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert
          variant="default"
          className="my-4 border-green-500 text-sm text-green-700"
        >
          <LuCircleAlert className="h-4 w-4" />
          <AlertDescription className="text-xs">{success}</AlertDescription>
        </Alert>
      )}

      <Alert variant="default" className="mt-4">
        <div className="flex items-center">
          <LuCircleAlert className="mr-2 h-4 w-4 flex-shrink-0" />
          <AlertDescription className="mt-0">
            Do not disclose your password to anyone, not even Lendasat support.
          </AlertDescription>
        </div>
      </Alert>
    </div>
  );
}
