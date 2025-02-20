import { UnlockWalletModal, useWallet } from "@frontend/browser-wallet";
import { useState } from "react";
import {
  FiatLoanDetailsResponse,
  InnerFiatLoanDetails,
} from "@frontend/base-http-client";
import {
  Button,
  Code,
  DataList,
  Flex,
  Heading,
  IconButton,
  Separator,
  Skeleton,
  Text,
} from "@radix-ui/themes";
import { Alert, Col, Row } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExclamationCircle } from "@fortawesome/free-solid-svg-icons";
import { CopyIcon } from "@radix-ui/react-icons";

interface DataListItemProps {
  label: string;
  value?: string;
  loading: boolean;
}

function DataListItem({ label, value, loading }: DataListItemProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <DataList.Item align="center">
      <DataList.Label minWidth="240px">{label}</DataList.Label>
      <DataList.Value>
        {loading ? (
          <Skeleton loading={loading} width="120px" height="20px" />
        ) : (
          <Flex align="center" gap="2">
            <Code variant="ghost"> {value}</Code>
            <IconButton
              size="1"
              aria-label="Copy value"
              color="gray"
              variant="ghost"
              onClick={() => {
                handleCopy(value || "");
              }}
            >
              <CopyIcon />
            </IconButton>
            {copied && (
              <Text
                size={"1"}
                weight={"light"}
                color={"green"}
                className="text-success"
              >
                Copied to clipboard!
              </Text>
            )}
          </Flex>
        )}
      </DataList.Value>
    </DataList.Item>
  );
}

interface BankingDetailsSummaryProps {
  fiatLoanDetails?: FiatLoanDetailsResponse;
}

export const BankingDetailsSummary = ({
  fiatLoanDetails,
}: BankingDetailsSummaryProps) => {
  const { isWalletLoaded, decryptFiatLoanDetails } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [isDecrypted, setIsDecrypted] = useState(false);
  const [loanDetails, setLoanDetails] = useState<
    InnerFiatLoanDetails | undefined
  >();

  const [error, setError] = useState("");

  const [showUnlockWalletModal, setShowUnlockWalletModal] = useState(false);
  const handleCloseUnlockWalletModal = () => setShowUnlockWalletModal(false);
  const handleOpenUnlockWalletModal = () => setShowUnlockWalletModal(true);
  const handleSubmitUnlockWalletModal = async () => {
    handleCloseUnlockWalletModal();
  };

  const onUnlockWalletOrDecryptPaymentDetails = async () => {
    if (!isWalletLoaded) {
      setIsLoading(true);
      handleOpenUnlockWalletModal();
      setIsLoading(false);
      return;
    } else {
      if (fiatLoanDetails) {
        try {
          const loanDetails = await decryptFiatLoanDetails(
            fiatLoanDetails.details,
            fiatLoanDetails.encrypted_encryption_key,
          );
          setLoanDetails(loanDetails);
          setIsDecrypted(true);
        } catch (e) {
          console.error(`Failed to decrypt fiat payment details ${e}`);
          setError(`${e}`);
        } finally {
          setIsLoading(false);
        }
      }
    }
  };

  console.log(`loanDetails ${JSON.stringify(loanDetails)}`);

  const isIban = loanDetails?.iban_transfer_details !== undefined;

  return (
    <Flex direction={"column"}>
      <UnlockWalletModal
        show={showUnlockWalletModal}
        handleClose={handleCloseUnlockWalletModal}
        handleSubmit={handleSubmitUnlockWalletModal}
      />

      <Heading
        size="3"
        weight="bold"
        mt="3"
        mb={"2"}
        className={"text-font dark:text-font-dark"}
      >
        Banking Details
      </Heading>

      <DataList.Root>
        {isIban && (
          <>
            <DataListItem
              loading={isLoading || !isDecrypted}
              label={"IBAN"}
              value={loanDetails?.iban_transfer_details?.iban}
            />
            <DataListItem
              loading={isLoading || !isDecrypted}
              label={"BIC"}
              value={loanDetails?.iban_transfer_details?.bic}
            />
          </>
        )}
        {!isIban && (
          <>
            <DataListItem
              loading={isLoading || !isDecrypted}
              label={"Account number"}
              value={loanDetails?.swift_transfer_details?.account_number}
            />
            <DataListItem
              loading={isLoading || !isDecrypted}
              label={"SWIFT or BIC"}
              value={loanDetails?.swift_transfer_details?.swift_or_bic}
            />
          </>
        )}
        <DataListItem
          loading={isLoading || !isDecrypted}
          label={"Bank Name"}
          value={loanDetails?.bank_name}
        />
        <DataListItem
          loading={isLoading || !isDecrypted}
          label={"Bank Address"}
          value={loanDetails?.bank_address}
        />
        <DataListItem
          loading={isLoading || !isDecrypted}
          label={"Bank Country"}
          value={loanDetails?.bank_country}
        />
        <DataListItem
          loading={isLoading || !isDecrypted}
          label={"Payment purpose"}
          value={loanDetails?.purpose_of_remittance}
        />
      </DataList.Root>
      <Separator
        orientation="horizontal"
        size={"4"}
        color={"purple"}
        mt={"4"}
      />
      <DataList.Root>
        <Heading
          size="3"
          weight="bold"
          mt="3"
          mb={"2"}
          className={"text-font dark:text-font-dark"}
        >
          Beneficiary Details
        </Heading>

        <DataListItem
          loading={isLoading || !isDecrypted}
          label={"Full Name"}
          value={loanDetails?.full_name}
        />
        <DataListItem
          loading={isLoading || !isDecrypted}
          label={"Address"}
          value={`${loanDetails?.address}, ${loanDetails?.city}, ${loanDetails?.post_code}, ${loanDetails?.country}`}
        />
        <DataListItem
          loading={isLoading || !isDecrypted}
          label={"Additional comments"}
          value={loanDetails?.comments}
        />
      </DataList.Root>

      <DataList.Root mt={"6"}>
        <DataList.Item>
          <DataList.Label minWidth="240px"></DataList.Label>
          <DataList.Value>
            <Button
              onClick={onUnlockWalletOrDecryptPaymentDetails}
              loading={isLoading}
              disabled={isDecrypted}
            >
              {isWalletLoaded ? "Decrypt payment details" : "Unlock Wallet"}
            </Button>
          </DataList.Value>
        </DataList.Item>
      </DataList.Root>

      <Row className="mt-3">
        <Col>
          {error && (
            <Alert variant="danger">
              <FontAwesomeIcon
                icon={faExclamationCircle}
                className="h-4 w-4 mr-2"
              />
              {error}
            </Alert>
          )}
        </Col>
      </Row>
    </Flex>
  );
};
