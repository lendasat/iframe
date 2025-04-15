import { useState, useEffect } from "react";
import { useAuth, useBorrowerHttpClient } from "@frontend/http-client-borrower";
import { Card, CardContent, CardHeader, CardTitle } from "@frontend/shadcn";
import { Input } from "@frontend/shadcn";
import { Button } from "@frontend/shadcn";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@frontend/shadcn";
import { LuCopy, LuCheck, LuShare } from "react-icons/lu";
import { PersonalReferralCode } from "@frontend/base-http-client";
// todo add toast
// import { toast } from "@frontend/shadcn";

export function MembersGetMemberSection() {
  const [copied, setCopied] = useState(false);
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState<PersonalReferralCode>();

  const referralUrl = `https://borrow.lendasat.com?ref=${referralCode}`;

  useEffect(() => {
    async function fetchReferralCode() {
      try {
        // Replace this with actual API call when implemented
        // const code = await getUserReferralCode();
        if (user?.personal_referral_codes) {
          setReferralCode(user.personal_referral_codes[0])
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
      // toast({
      //   title: "Copied!",
      //   description: "Referral link copied to clipboard",
      // });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // toast({
      //   title: "Failed to copy",
      //   description: "Please try again or copy manually",
      //   variant: "destructive",
      // });
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

  return (
    <Card className="dark:bg-dark-700 h-full min-h-72">
      <CardHeader className="pb-2">
        <CardTitle className="text-font dark:text-font-dark text-lg font-medium">
          Refer Your Friends!
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-font/70 dark:text-font-dark/70 text-sm">
            Share your personal referral link and earn rewards when friends join!
          </p>

          <div className="border-font/10 dark:border-font-dark/20 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Input
                value={referralUrl}
                readOnly
                className="text-font dark:text-font-dark flex-1"
              />
              <TooltipProvider>
                <Tooltip open={copied} onOpenChange={setCopied}>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={copyToClipboard}
                      variant="outline"
                      size="icon"
                      className="h-10 w-10"
                    >
                      {copied ? <LuCheck className="h-4 w-4" /> : <LuCopy className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-xs">Copied!</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
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

          <div className="grid grid-cols-3 gap-3 mt-2">
            <div className="border-font/10 dark:border-font-dark/20 rounded-xl border p-3 text-center">
              <h3 className="text-font dark:text-font-dark text-xl font-semibold">
                0
              </h3>
              <p className="text-font/70 dark:text-font-dark/70 text-xs font-medium">
                Referrals
              </p>
            </div>
            <div className="border-font/10 dark:border-font-dark/20 rounded-xl border p-3 text-center">
              <h3 className="text-font dark:text-font-dark text-xl font-semibold">
                $0
              </h3>
              <p className="text-font/70 dark:text-font-dark/70 text-xs font-medium">
                Earned
              </p>
            </div>
            <div className="border-font/10 dark:border-font-dark/20 rounded-xl border p-3 text-center">
              <h3 className="text-font dark:text-font-dark text-xl font-semibold">
                5%
              </h3>
              <p className="text-font/70 dark:text-font-dark/70 text-xs font-medium">
                Bonus
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default MembersGetMemberSection;
