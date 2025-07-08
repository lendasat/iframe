import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@frontend/shadcn";
import { LuCopy } from "react-icons/lu";
import { toast } from "sonner";

type PersonalReferralCode = {
  code: string;
  active: boolean;
  first_time_discount_rate_referee: number;
  first_time_commission_rate_referrer: number;
  commission_rate_referrer: number;
  created_at: string;
  expires_at: string;
};

type ReferralCodesTableProps = {
  referralCodes: PersonalReferralCode[];
};

export const ReferralCodesTable = ({
  referralCodes,
}: ReferralCodesTableProps) => {
  const filteredCodes = referralCodes.filter((code) => code.active);

  const handleCopyLink = async (code: string) => {
    try {
      const baseUrl = window.location.origin;
      const refCode = `${baseUrl}/registration?ref=${code}`;
      await navigator.clipboard.writeText(refCode);
      toast.success(`Copied referral code.`);
    } catch (e) {
      console.error(`Failed to copy referral code: ${e}`);
      toast.error(`Failed to copy referral code.`);
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            <div className={"text-font dark:text-font-dark"}>Code</div>
          </TableHead>
          <TableHead>
            <div className={"text-font dark:text-font-dark"}>
              Referred user discount
            </div>
          </TableHead>
          <TableHead>
            <div className={"text-font dark:text-font-dark"}>
              First loan commission
            </div>
          </TableHead>
          <TableHead>
            <div className={"text-font dark:text-font-dark"}>
              Other loan commission
            </div>
          </TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {filteredCodes.map((code) => (
          <TableRow key={code.code}>
            <TableCell>
              <div className="flex items-center">
                <div className={"text-font dark:text-font-dark mr-2"}>
                  <Badge>
                    <code>{code.code}</code>
                  </Badge>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleCopyLink(code.code)}
                >
                  <LuCopy />
                </Button>
              </div>
            </TableCell>
            <TableCell>
              <div className={"text-font dark:text-font-dark"}>
                -{(code.first_time_discount_rate_referee * 100).toFixed(1)}%
              </div>
            </TableCell>
            <TableCell>
              <div className={"text-font dark:text-font-dark"}>
                {(code.first_time_commission_rate_referrer * 100).toFixed(1)}%
              </div>
            </TableCell>
            <TableCell>
              <div className={"text-font dark:text-font-dark"}>
                {(code.commission_rate_referrer * 100).toFixed(1)}%
              </div>
            </TableCell>
          </TableRow>
        ))}
        {referralCodes.length === 0 && (
          <TableRow>
            <TableCell colSpan={5} align="center">
              <div className={"text-font dark:text-font-dark"}>
                No referral codes found
              </div>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
};
