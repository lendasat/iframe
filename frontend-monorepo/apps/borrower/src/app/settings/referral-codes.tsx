import { Badge, Box, Table, Text } from "@radix-ui/themes";
import { useState } from "react";
import { FaCheckCircle, FaCopy } from "react-icons/fa";
import { NotificationToast } from "@frontend/ui-shared";

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
  const [copied, setCopied] = useState(false);

  const filteredCodes = referralCodes.filter((code) => code.active);

  const handleCopyLink = async (code: string) => {
    try {
      const baseUrl = window.location.origin;
      await navigator.clipboard.writeText(
        `${baseUrl}/registration?ref=${code}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(`Failed to copy text to clipboard: ${e}`);
    }
  };

  return (
    <Table.Root variant="surface">
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeaderCell>
            <Text
              className={"text-font dark:text-font-dark"}
              size={"2"}
              weight={"medium"}
            >
              Code
            </Text>
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>
            <Text
              className={"text-font dark:text-font-dark"}
              size={"2"}
              weight={"medium"}
            >
              Referred user discount
            </Text>
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>
            <Text
              className={"text-font dark:text-font-dark"}
              size={"2"}
              weight={"medium"}
            >
              First loan commission
            </Text>
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>
            <Text
              className={"text-font dark:text-font-dark"}
              size={"2"}
              weight={"medium"}
            >
              Other loan commission
            </Text>
          </Table.ColumnHeaderCell>
        </Table.Row>
      </Table.Header>

      <Table.Body>
        {filteredCodes.map((code) => (
          <Table.Row key={code.code}>
            <Table.Cell>
              <Box className="flex items-center">
                <Text
                  className={"text-font dark:text-font-dark mr-2"}
                  size={"1"}
                  weight={"medium"}
                >
                  <Badge size={"3"}>
                    <code>{code.code}</code>
                  </Badge>
                </Text>
                <NotificationToast
                  description={code.code}
                  title={"Referral link copied"}
                >
                  {copied ? (
                    <FaCheckCircle
                      className={"text-font dark:text-font-dark"}
                    />
                  ) : (
                    <FaCopy
                      onClick={() => handleCopyLink(code.code)}
                      className={"text-font dark:text-font-dark"}
                    />
                  )}
                </NotificationToast>
              </Box>
            </Table.Cell>
            <Table.Cell>
              <Text
                className={"text-font dark:text-font-dark"}
                size={"1"}
                weight={"medium"}
              >
                -{(code.first_time_discount_rate_referee * 100).toFixed(1)}%
              </Text>
            </Table.Cell>
            <Table.Cell>
              <Text
                className={"text-font dark:text-font-dark"}
                size={"1"}
                weight={"medium"}
              >
                {(code.first_time_commission_rate_referrer * 100).toFixed(1)}%
              </Text>
            </Table.Cell>
            <Table.Cell>
              <Text
                className={"text-font dark:text-font-dark"}
                size={"1"}
                weight={"medium"}
              >
                {(code.commission_rate_referrer * 100).toFixed(1)}%
              </Text>
            </Table.Cell>
          </Table.Row>
        ))}
        {referralCodes.length === 0 && (
          <Table.Row>
            <Table.Cell colSpan={5} align="center">
              <Text
                className={"text-font dark:text-font-dark"}
                size={"1"}
                weight={"medium"}
              >
                No referral codes found
              </Text>
            </Table.Cell>
          </Table.Row>
        )}
      </Table.Body>
    </Table.Root>
  );
};
