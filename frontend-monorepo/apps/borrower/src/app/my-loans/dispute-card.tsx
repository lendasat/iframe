import type { IconProp } from "@fortawesome/fontawesome-svg-core";
import { faExclamationCircle, faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import * as Collapsible from "@radix-ui/react-collapsible";
import { Box, Button, Callout, Heading, Select, TextArea } from "@radix-ui/themes";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { RxCross2, RxRowSpacing } from "react-icons/rx";

interface ExpandableDisputeCardProps {
  info: string;
  error: string;
  onStartDispute: (selectedReason: string, comment: string) => void;
  startingDisputeLoading: boolean;
  disputeInProgress: boolean;
}

interface AlertMessageProps {
  variant: "amber" | "teal" | "red";
  icon: IconProp;
  children: ReactNode;
}

const AlertMessage = ({ variant, icon, children }: AlertMessageProps) => (
  <Callout.Root className="w-full" color={variant}>
    <Callout.Icon>
      <FontAwesomeIcon icon={icon} className="h-4 w-4" />
    </Callout.Icon>
    <Callout.Text>
      {children}
    </Callout.Text>
  </Callout.Root>
);

export const ExpandableDisputeCard = (
  { info, error, onStartDispute, startingDisputeLoading, disputeInProgress }: ExpandableDisputeCardProps,
) => {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedReason, setSelectedReason] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [isOtherReasonValid, setIsOtherReasonValid] = useState(true);

  const disputeReasons = [
    "Payment issue: Did not receive loan amount",
    "Repayment issue: Did not receive back collateral",
    "Other",
  ];

  useEffect(() => {
    if (selectedReason === "Other") {
      setIsOtherReasonValid(otherReason.trim() !== "");
    } else {
      setIsOtherReasonValid(true);
    }
  }, [selectedReason, otherReason]);

  const getAlertContent = () => {
    if (info) {
      return (
        <AlertMessage variant="teal" icon={faInfoCircle}>
          {info}
        </AlertMessage>
      );
    } else if (disputeInProgress) {
      return (
        <AlertMessage variant="amber" icon={faInfoCircle}>
          A dispute is currently in progress. Please share any additional information via email.
        </AlertMessage>
      );
    } else {
      return (
        <AlertMessage variant="amber" icon={faInfoCircle}>
          Something is not right? Please start a dispute. Before doing so ensure that your email address is up to date.
        </AlertMessage>
      );
    }
  };

  const [open, setOpen] = useState(false);

  return (
    <Collapsible.Root className="w-full" open={open} onOpenChange={setOpen}>
      <Box className="p-5 md:px-7 rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <Heading>
            Dispute Information
          </Heading>
          <Collapsible.Trigger asChild>
            <button className="inline-flex size-[25px] items-center justify-center rounded-full text-violet11 shadow-[0_2px_10px] shadow-blackA4 outline-none hover:bg-violet3 focus:shadow-[0_0_0_2px] focus:shadow-black data-[state=closed]:bg-white data-[state=open]:bg-violet3">
              {open ? <RxCross2 /> : <RxRowSpacing />}
            </button>
          </Collapsible.Trigger>
        </div>

        <Collapsible.Content>
          <>
            {getAlertContent()}
            <Box>
              <Select.Root
                value={selectedReason}
                onValueChange={(reason) => setSelectedReason(reason)}
                size={"3"}
              >
                <Select.Trigger
                  placeholder="Select reason"
                  color="gray"
                  className="shadow-none focus-visible:outline-none p-3 outline-none font-normal text-sm w-full border z-50 rounded-lg"
                  variant="soft"
                />
                <Select.Content>
                  {disputeReasons.map((reason, index) => <Select.Item key={index} value={reason}>{reason}
                  </Select.Item>)}
                </Select.Content>
              </Select.Root>
            </Box>
            <TextArea
              color="gray"
              resize={"none"}
              className="h-40 rounded-lg focus-visible:outline-none outline-none p-2"
              variant="soft"
              value={otherReason}
              onChange={(e) => setOtherReason(e.target.value)}
              placeholder="Please describe the reason for the dispute..."
            />
            {!disputeInProgress && error && (
              <Box>
                <AlertMessage variant="red" icon={faExclamationCircle}>
                  {error}
                </AlertMessage>
              </Box>
            )}
            <Button
              size={"3"}
              color="purple"
              className="w-full"
              onClick={(event) => {
                event.preventDefault();
                setIsLoading(true);
                setTimeout(() => {
                  onStartDispute(selectedReason, otherReason);
                  setIsLoading(false);
                }, 1000);
              }}
              loading={isLoading}
              disabled={startingDisputeLoading || !selectedReason || !isOtherReasonValid || !otherReason || isLoading}
            >
              Start dispute
            </Button>
          </>
        </Collapsible.Content>
      </Box>
    </Collapsible.Root>
  );
};
