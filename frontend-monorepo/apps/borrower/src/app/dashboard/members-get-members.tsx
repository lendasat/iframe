import { useState, useEffect } from "react";
import { useAuth } from "@frontend/http-client-borrower";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@frontend/shadcn";
import { Input } from "@frontend/shadcn";
import { Button } from "@frontend/shadcn";
import { LuCopy, LuCheck, LuShare, LuInfo } from "react-icons/lu";
import { PersonalReferralCode } from "@frontend/base-http-client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export function MembersGetMemberSection() {
  const [copied, setCopied] = useState(false);
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState<PersonalReferralCode>();
  const navigate = useNavigate();

  const referralUrl = `https://borrow.lendasat.com/registration?ref=${referralCode?.code}`;

  useEffect(() => {
    async function fetchReferralCode() {
      try {
        if (user?.personal_referral_codes) {
          setReferralCode(user.personal_referral_codes[0]);
        }
      } catch (error) {
        console.error("Failed to fetch referral code:", error);
      }
    }

    fetchReferralCode();
  }, []);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      toast("Copied!", {
        description: "Referral link copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast("Failed to copy!", {
        description: "Please try again or copy manually",
      });
    }
  };

  const shareReferralLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join LendaSat",
          text: "Use my referral link to sign up for LendaSat and get special benefits!",
          url: referralUrl,
        });
      } catch (error) {
        console.error("Error sharing:", error);
      }
    } else {
      await copyToClipboard();
    }
  };

  if (!referralCode) {
    return <></>;
  }

  return (
    <div className="flex flex-col mt-4 mb-4">
      <Card className="dark:bg-dark-700 h-60">
        <CardHeader className="pb-2">
          <CardTitle className="text-font dark:text-font-dark text-lg font-medium">
            <div className="flex items-center justify-between">
              <CardTitle className="text-font dark:text-font-dark text-lg font-medium">
                Refer Your Friends!
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  navigate("/settings/profile");
                }}
              >
                <LuInfo className="h-4 w-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardFooter>
          <div className="space-y-4 mt-6">
            <p className="text-font/70 dark:text-font-dark/70 text-sm">
              Share your personal referral link and earn rewards when friends
              join!
            </p>

            <div className="border-font/10 dark:border-font-dark/20 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Input
                  value={referralUrl}
                  readOnly
                  className="text-font dark:text-font-dark flex-1"
                />
                <Button
                  onClick={copyToClipboard}
                  variant="outline"
                  size="icon"
                  className="h-10 w-10"
                >
                  {copied ? (
                    <LuCheck className="h-4 w-4" />
                  ) : (
                    <LuCopy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  onClick={shareReferralLink}
                  variant="outline"
                  size="icon"
                  className="h-10 w-10"
                >
                  <LuShare className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

export default MembersGetMemberSection;
