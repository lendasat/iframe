import type { IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { faExclamationCircle, faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Box, Button, Callout, Heading, Select, TextArea } from "@radix-ui/themes";
import { useEffect, useState } from "react";

interface ExpandableDisputeCardProps {
  info: string;
  error: string;
  onStartDispute: (selectedReason: string, comment: string) => void;
  startingDisputeLoading: boolean;
  disputeInProgress: boolean;
}

interface AlertProps {
  variant: "amber" | "teal" | "red";
  icon: IconDefinition;
  children: string;
}

const AlertMessage = ({ variant, icon, children }: AlertProps) => (
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
    "Repayment issue: Did not receive correct amount",
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

  return (
    <Box className="p-5 md:px-7 rounded-xl space-y-4">
      <Heading>
        Dispute Information
      </Heading>
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
            {disputeReasons.map((reason, index) => <Select.Item key={index} value={reason}>{reason}</Select.Item>)}
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
    </Box>
  );
};
