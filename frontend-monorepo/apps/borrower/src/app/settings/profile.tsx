import { useState } from "react";
import { useBaseHttpClient } from "@frontend/base-http-client";
import { useAuth, useBorrowerHttpClient } from "@frontend/http-client-borrower";
import { EditableTimezoneField } from "@frontend/ui-shared";
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
} from "@frontend/shadcn";
import { ReferralCodesTable } from "./referral-codes";
import { format } from "date-fns";
import { LuCircleAlert, LuLoader, LuPencil } from "react-icons/lu";
import { toast } from "sonner";

export function Profile() {
  const { user } = useAuth();
  const { forgotPassword } = useBaseHttpClient();
  const { putUpdateProfile } = useBorrowerHttpClient();
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    <div className="space-y-4 max-w-3xl mx-auto">
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
              <p className="text-xs text-gray-500">
                {format(user.created_at, "MMM, dd yyyy - p")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-1 pt-3 px-4">
          <h4 className="text-sm font-semibold">Personal information</h4>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-gray-500 font-medium">
                Full Name
              </label>
              <p className="text-sm font-medium">{user.name}</p>
            </div>

            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-gray-500 font-medium">
                Email Address
              </label>
              <p className="text-sm font-medium">{user.email}</p>
            </div>

            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-gray-500 font-medium">
                Password
              </label>
              <div className="flex flex-row justify-between">
                <p className="text-sm font-medium">********</p>
                <Button
                  onClick={handleResetPassword}
                  variant={"ghost"}
                  disabled={isLoading}
                  size={"icon"}
                >
                  {isLoading ? (
                    <>
                      <LuLoader className="animate-spin" />
                    </>
                  ) : (
                    <LuPencil className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-gray-500 font-medium">
                Timezone
              </label>
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
              <label className="text-xs text-gray-500 font-medium">
                Joined on
              </label>
              <p className="text-sm font-medium">
                {format(user.created_at, "MMM, dd yyyy - p")}
              </p>
            </div>

            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-gray-500 font-medium">
                Used referral code
              </label>
              <Badge variant="outline">
                {user.used_referral_code || "None"}
              </Badge>
            </div>

            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-gray-500 font-medium">
                Current discount on origination fee
              </label>
              <p className="text-sm font-medium">
                {(-discountRate * 100).toFixed(2)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm pb-24">
        <CardHeader className="pb-1 pt-3 px-4">
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
                  You don't have a personal referral code yet. Reach out to us
                  if you want to take part in the affiliation program
                </AlertDescription>
              </Alert>
            ))}
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" className="text-sm my-4">
          <LuCircleAlert className="h-4 w-4" />
          <AlertDescription className="text-xs">{error}</AlertDescription>
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
