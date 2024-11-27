import { faExclamationCircle, faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useWallet } from "@frontend-monorepo/browser-wallet";
import type { Contract } from "@frontend-monorepo/http-client-lender";
import {
  ContractStatus,
  contractStatusToLabelString,
  LiquidationStatus,
  TransactionType,
  useAuth,
  useLenderHttpClient,
} from "@frontend-monorepo/http-client-lender";
import {
  AprInfoLabel,
  CurrencyFormatter,
  formatCurrency,
  LtvInfoLabel,
  StableCoinHelper,
} from "@frontend-monorepo/ui-shared";
import { Badge, Box, Button, Callout, Flex, Grid, Heading, Separator, Text } from "@radix-ui/themes";
import { Suspense, useState } from "react";
import { Alert, Col, Row, Spinner } from "react-bootstrap";
import { FaCopy, FaInfoCircle } from "react-icons/fa";
import { IoMdCloudDownload } from "react-icons/io";
import { Await, useNavigate, useParams } from "react-router-dom";
import TransactionList from "../components/transaction-list";
import { ExpandableDisputeCard } from "../disputes/dispute-card";
import { ContractRequested } from "./contract-requested";
import { downloadLocalStorage } from "./download-local-storage";
import RepaymentDetails from "./pay-loan-principal";

function ContractDetailsOverview() {
  const { innerHeight } = window;
  const { getContract } = useLenderHttpClient();
  const { id } = useParams();

  return (
    <Suspense>
      <Await
        resolve={id ? getContract(id) : null}
        errorElement={<div>Could not load contracts</div>}
        children={(contract: Awaited<Contract>) => (
          <Box
            style={{
              overflowY: "scroll",
              height: innerHeight - 130,
            }}
          >
            <Details contract={contract} />
          </Box>
        )}
      />
    </Suspense>
  );
}

export default ContractDetailsOverview;

interface DetailsProps {
  contract: Contract;
}

function Details({ contract }: DetailsProps) {
  return (
    <Box className="h-full">
      <ContractDetails contract={contract} />
    </Box>
  );
}

interface DetailsProps {
  contract: Contract;
}

function ContractDetails({ contract }: DetailsProps) {
  const { startDispute } = useLenderHttpClient();
  const { backendVersion } = useAuth();

  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [startingDisputeLoading, setStartingDisputeLoading] = useState(false);

  const collateral_sats = contract.initial_collateral_sats;
  const collateral = collateral_sats / 100000000;
  const loanAmount = contract.loan_amount;
  const durationMonths = contract.duration_months;

  const interestRate = contract.interest_rate;

  const initialLtv = contract.initial_ltv;

  const initialLtvFormatted = (initialLtv * 100).toFixed(0);

  const disputeInProgress = contract.status === ContractStatus.DisputeBorrowerResolved
    || contract.status === ContractStatus.DisputeLenderResolved
    || contract.status === ContractStatus.DisputeBorrowerStarted
    || contract.status === ContractStatus.DisputeLenderStarted;

  const onStartDispute = async (reason: string, comment: string) => {
    setStartingDisputeLoading(true);
    try {
      await startDispute(contract.id, reason, comment);
      setInfo("A new dispute was started, please check your email");
      setError("");
    } catch (error) {
      setInfo("");
      setError(`${error}`);
    } finally {
      setStartingDisputeLoading(false);
    }
  };

  let contractStatusLabel = contractStatusToLabelString(contract.status);
  const firstMarginCall = contract.liquidation_status === LiquidationStatus.FirstMarginCall;
  const secondMarginCall = contract.liquidation_status === LiquidationStatus.SecondMarginCall;
  const liquidated = contract.liquidation_status === LiquidationStatus.Liquidated;

  if (firstMarginCall) {
    contractStatusLabel = "First Margin Call";
  }
  if (secondMarginCall) {
    contractStatusLabel = "Second Margin Call";
  }
  if (liquidated) {
    contractStatusLabel = "Liquidated";
  }

  const actualInterestUsdAmount = (loanAmount * interestRate) / (12 / durationMonths);
  const [contractIdCopied, setContractIdCopied] = useState<boolean>(false);
  const [errorAlt, setErrorAlt] = useState("");
  const navigate = useNavigate();

  const onSuccess = () => {
    navigate(0);
  };

  const onError = (error: string) => {
    setErrorAlt(error);
  };

  const formatId = (id: string) => {
    const start = id.slice(0, 6);
    const end = id.slice(-4);
    return `${start}...${end}`;
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setContractIdCopied(true);
      setTimeout(() => setContractIdCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const displayDispute = contract.status !== ContractStatus.Requested
    && contract.status !== ContractStatus.Approved;

  const stableCoin = StableCoinHelper.mapFromBackend(
    contract.loan_asset_chain,
    contract.loan_asset_type,
  );

  return (
    <Grid className="md:grid-cols-2">
      <Box className="border-r border-font/10">
        <Box className="p-6 md:pl-8 border-b border-font/10">
          <Heading size={"6"}>Contract Details</Heading>
        </Box>
        <Box className="p-6 md:p-8 space-y-5">
          <Flex gap={"5"} align={"start"} justify={"between"}>
            <Text
              size={"2"}
              weight={"medium"}
              className="shrink-0 text-font/70"
            >
              Borrower
            </Text>
            <Box className="max-w-sm text-end">
              <div className="flex flex-col">
                <Text size={"2"} weight={"medium"} className="break-all">
                  {contract.borrower.name}
                </Text>
              </div>
            </Box>
          </Flex>
          <Separator size={"4"} className="bg-font/10" />

          <Flex gap={"5"} align={"start"} justify={"between"}>
            <Text
              size={"2"}
              weight={"medium"}
              className="text-font/70 shrink-0"
            >
              Contract ID
            </Text>
            {contractIdCopied
              ? (
                <Text size={"2"} className="font-medium" color="green">
                  Copied
                </Text>
              )
              : (
                <Text
                  onClick={() => handleCopy(contract.id)}
                  size={"2"}
                  weight={"medium"}
                  className="text-end cursor-copy hover:opacity-70 flex items-center gap-1"
                >
                  {formatId(contract.id)} <FaCopy />
                </Text>
              )}
          </Flex>
          <Separator size={"4"} className="bg-font/10" />

          <Flex gap={"5"} align={"center"} justify={"between"}>
            <Text size={"2"} weight={"medium"} className="text-font/70">
              Contract status
            </Text>
            <Text size={"2"} weight={"medium"}>
              <Badge
                color={contract.status === ContractStatus.Requested
                  ? "amber"
                  : contract.status === ContractStatus.Approved
                  ? "green"
                  : contract.status === ContractStatus.Rejected
                  ? "red"
                  : "gray"}
                size={"2"}
              >
                {contractStatusLabel}
              </Badge>
            </Text>
          </Flex>
          <Separator size={"4"} className="bg-font/10" />

          <Flex gap={"5"} align={"start"} justify={"between"}>
            <Text size={"2"} weight={"medium"} className="text-font/70">
              Loan Amount
            </Text>
            <Text size={"2"} weight={"medium"}>
              <CurrencyFormatter value={loanAmount} />
            </Text>
          </Flex>
          <Separator size={"4"} className="bg-font/10" />

          <Flex gap={"5"} align={"start"} justify={"between"}>
            <Text size={"2"} weight={"medium"} className="text-font/70">
              Asset
            </Text>
            <Text size={"2"} weight={"medium"}>
              <Text>
                {stableCoin ? <Badge>{StableCoinHelper.print(stableCoin)}</Badge> : (
                  <>
                    {contract.loan_asset_chain}
                    {contract.loan_asset_type}
                  </>
                )}
              </Text>
            </Text>
          </Flex>
          <Separator size={"4"} className="bg-font/10" />

          <Flex gap={"5"} align={"start"} justify={"between"}>
            <Text size={"2"} weight={"medium"} className="text-font/70">
              Duration
            </Text>
            <Text size={"2"} weight={"medium"}>
              {durationMonths} months
            </Text>
          </Flex>
          <Separator size={"4"} className="bg-font/10" />

          <Flex gap={"5"} align={"start"} justify={"between"}>
            <Text size={"2"} weight={"medium"} className="text-font/70">
              Collateral
            </Text>
            <Text size={"2"} weight={"medium"}>
              {collateral.toFixed(8)} BTC
            </Text>
          </Flex>
          <Separator size={"4"} className="bg-font/10" />

          <Flex gap={"5"} align={"start"} justify={"between"}>
            <LtvInfoLabel>
              <Text size={"2"} weight={"medium"} className="text-font/70">
                Initial LTV ratio
              </Text>
              <FaInfoCircle className="text-font-dark" />
            </LtvInfoLabel>
            <Text size={"2"} weight={"medium"}>
              {initialLtvFormatted}%
            </Text>
          </Flex>
          <Separator size={"4"} className="bg-font/10" />

          <Flex gap={"5"} align={"start"} justify={"between"}>
            <AprInfoLabel>
              <Flex align={"center"} gap={"2"} className="text-font-dark">
                <Text size={"2"} weight={"medium"} className="text-font/70">
                  Interest Rate (APR)
                </Text>
                <FaInfoCircle />
              </Flex>
            </AprInfoLabel>

            <div className="flex flex-col">
              <Text size={"2"} weight={"medium"}>
                {(interestRate * 100).toFixed(2)}% per year
              </Text>
              <Text className="text-[11px] text-black/50 mt-0.5 self-end">
                ≈ {formatCurrency(actualInterestUsdAmount, 1, 1)} in total
              </Text>
            </div>
          </Flex>
          <Separator size={"4"} className="bg-font/10" />
          <AdditionalDetail contract={contract} />
          <Callout.Root>
            <Callout.Icon>
              <IoMdCloudDownload size={"18"} />
            </Callout.Icon>
            <Callout.Text>
              Download contract backup. It is encrypted with the contract secret you set during registration.
            </Callout.Text>
          </Callout.Root>
          <Flex align={"center"} justify={"end"}>
            <Button
              size="3"
              className="bg-btn"
              onClick={() => downloadLocalStorage(backendVersion)}
            >
              <IoMdCloudDownload />
              Download
            </Button>
          </Flex>

          {errorAlt && (
            <Callout.Root color="red">
              <Callout.Icon>
                <FontAwesomeIcon
                  icon={faExclamationCircle}
                  className="h-4 w-4"
                />
              </Callout.Icon>
              <Callout.Text>{errorAlt}</Callout.Text>
            </Callout.Root>
          )}
        </Box>
      </Box>
      <Box className="p-6 md:p-8 space-y-5">
        <ContractStatusDetails
          contract={contract}
          onError={onError}
          onSuccess={onSuccess}
        />

        {displayDispute && (
          <Box>
            <ExpandableDisputeCard
              info={info}
              onStartDispute={onStartDispute}
              startingDisputeLoading={startingDisputeLoading}
              error={error}
              disputeInProgress={disputeInProgress}
            />
          </Box>
        )}
      </Box>
    </Grid>
  );
}

interface AdditionalDetailsProps {
  contract: Contract;
}

const AdditionalDetail = ({ contract }: AdditionalDetailsProps) => {
  const fundingTransaction = contract.transactions.find(
    (tx) => tx.transaction_type === TransactionType.Funding,
  );
  const claimTransaction = contract.transactions.find(
    (tx) => tx.transaction_type === TransactionType.ClaimCollateral,
  );
  const principalRepaidTransaction = contract.transactions.find(
    (tx) => tx.transaction_type === TransactionType.PrincipalRepaid,
  );
  const principalGivenTransaction = contract.transactions.find(
    (tx) => tx.transaction_type === TransactionType.PrincipalGiven,
  );

  let fundingTxDetails;
  if (fundingTransaction) {
    fundingTxDetails = (
      <TransactionList
        contract={contract}
        transactionType={TransactionType.Funding}
      />
    );
  }

  let claimTransactionDetails;
  if (claimTransaction) {
    claimTransactionDetails = (
      <TransactionList
        contract={contract}
        transactionType={TransactionType.ClaimCollateral}
      />
    );
  }

  let principalRepaidDetails;
  if (principalRepaidTransaction) {
    principalRepaidDetails = (
      <TransactionList
        contract={contract}
        transactionType={TransactionType.PrincipalRepaid}
      />
    );
  }

  let principalGivenDetails;
  if (principalGivenTransaction) {
    principalGivenDetails = (
      <TransactionList
        contract={contract}
        transactionType={TransactionType.PrincipalGiven}
      />
    );
  }

  switch (contract.status) {
    case ContractStatus.Requested:
      break;
    case ContractStatus.Approved:
      break;
    case ContractStatus.CollateralSeen:
    case ContractStatus.CollateralConfirmed:
      return (
        <Box className="space-y-5">
          <Flex gap={"5"} align={"start"} justify={"between"}>
            <Text size={"2"} weight={"medium"} className="text-font/70">
              Funding transaction
            </Text>
            <Text size={"2"} weight={"medium"}>
              {fundingTxDetails}
            </Text>
          </Flex>
          <Separator size={"4"} className="bg-font/10" />
        </Box>
      );
    case ContractStatus.PrincipalGiven:
      return (
        <>
          <Box className="space-y-5">
            <Flex gap={"5"} align={"start"} justify={"between"}>
              <Text size={"2"} weight={"medium"} className="text-font/70">
                Funding transaction
              </Text>
              <Text size={"2"} weight={"medium"}>
                {fundingTxDetails}
              </Text>
            </Flex>
            <Separator size={"4"} className="bg-font/10" />
          </Box>

          <Box className="space-y-5">
            <Flex gap={"5"} align={"start"} justify={"between"}>
              <Text size={"2"} weight={"medium"} className="text-font/70">
                Principal transaction
              </Text>
              <Text size={"2"} weight={"medium"}>
                {principalGivenDetails}
              </Text>
            </Flex>
            <Separator size={"4"} className="bg-font/10" />
          </Box>
        </>
      );
    case ContractStatus.RepaymentProvided:
    case ContractStatus.RepaymentConfirmed:
      return (
        <>
          <Box className="space-y-5">
            <Flex gap={"5"} align={"start"} justify={"between"}>
              <Text size={"2"} weight={"medium"} className="text-font/70">
                Funding transaction
              </Text>
              <Text size={"2"} weight={"medium"}>
                {fundingTxDetails}
              </Text>
            </Flex>
            <Separator size={"4"} className="bg-font/10" />
          </Box>

          <Box className="space-y-5">
            <Flex gap={"5"} align={"start"} justify={"between"}>
              <Text size={"2"} weight={"medium"} className="text-font/70">
                Principal transaction
              </Text>
              <Text size={"2"} weight={"medium"}>
                {principalGivenDetails}
              </Text>
            </Flex>
            <Separator size={"4"} className="bg-font/10" />
          </Box>

          <Box className="space-y-5">
            <Flex gap={"5"} align={"start"} justify={"between"}>
              <Text size={"2"} weight={"medium"} className="text-font/70">
                Principal repayment transaction
              </Text>
              <Text size={"2"} weight={"medium"}>
                {principalRepaidDetails}
              </Text>
            </Flex>
            <Separator size={"4"} className="bg-font/10" />
          </Box>
        </>
      );
    case ContractStatus.Closing:
    case ContractStatus.Closed:
      return (
        <>
          <Box className="space-y-5">
            <Flex gap={"5"} align={"start"} justify={"between"}>
              <Text size={"2"} weight={"medium"} className="text-font/70">
                Funding transaction
              </Text>
              <Text size={"2"} weight={"medium"}>
                {fundingTxDetails}
              </Text>
            </Flex>
            <Separator size={"4"} className="bg-font/10" />
          </Box>

          <Box className="space-y-5">
            <Flex gap={"5"} align={"start"} justify={"between"}>
              <Text size={"2"} weight={"medium"} className="text-font/70">
                Principal transaction
              </Text>
              <Text size={"2"} weight={"medium"}>
                {principalGivenDetails}
              </Text>
            </Flex>
            <Separator size={"4"} className="bg-font/10" />
          </Box>

          <Box className="space-y-5">
            <Flex gap={"5"} align={"start"} justify={"between"}>
              <Text size={"2"} weight={"medium"} className="text-font/70">
                Principal repayment transaction
              </Text>
              <Text size={"2"} weight={"medium"}>
                {principalRepaidDetails}
              </Text>
            </Flex>
            <Separator size={"4"} className="bg-font/10" />
          </Box>

          <Box className="space-y-5">
            <Flex gap={"5"} align={"start"} justify={"between"}>
              <Text size={"2"} weight={"medium"} className="text-font/70">
                Collateral claim transaction
              </Text>
              <Text size={"2"} weight={"medium"}>
                {claimTransactionDetails}
              </Text>
            </Flex>
            <Separator size={"4"} className="bg-font/10" />
          </Box>
        </>
      );
    case ContractStatus.Rejected:
    case ContractStatus.DisputeBorrowerStarted:
    case ContractStatus.DisputeLenderStarted:
    case ContractStatus.DisputeBorrowerResolved:
    case ContractStatus.DisputeLenderResolved:
    default:
      // TODO
      return "Details";
  }
};

interface ContractStatusDetailsProps {
  contract: Contract;
  onError: (error: string) => void;
  onSuccess: () => void;
}

const ContractStatusDetails = ({
  contract,
  onError,
  onSuccess,
}: ContractStatusDetailsProps) => {
  const { approveContract, rejectContract, principalGiven, markPrincipalConfirmed } = useLenderHttpClient();
  const [isLoading, setIsLoading] = useState(false);
  const [txid, setTxid] = useState("");
  const { getXpub, doesWalletExist } = useWallet();

  const [showCreateWalletModal, setShowCreateWalletModal] = useState(false);

  const onContractApprove = async () => {
    try {
      setIsLoading(true);

      const xpub = getXpub();

      await approveContract(contract.id, xpub);
      onSuccess();
    } catch (error) {
      onError(`${error}`);
    } finally {
      setIsLoading(false);
    }
  };
  const onContractReject = async () => {
    try {
      setIsLoading(true);
      await rejectContract(contract.id);
      onSuccess();
    } catch (error) {
      onError(`${error}`);
    } finally {
      setIsLoading(false);
    }
  };
  const onPrincipalGiven = async () => {
    try {
      setIsLoading(true);
      await principalGiven(contract.id, txid);
      onSuccess();
    } catch (error) {
      onError(`${error}`);
    } finally {
      setIsLoading(false);
    }
  };
  const onMarkAsRepaid = async () => {
    try {
      setIsLoading(true);
      await markPrincipalConfirmed(contract.id);
      onSuccess();
    } catch (error) {
      console.log(`Failed to mark as repaid ${error}`);
      onError(`${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const onCreateWalletButtonClick = async () => {
    if (doesWalletExist) {
      console.log("No need to create a wallet!");
      return;
    }

    setShowCreateWalletModal(true);
  };
  const handleCloseCreateWalletModal = () => setShowCreateWalletModal(false);

  switch (contract.status) {
    case ContractStatus.Requested:
      return (
        <ContractRequested
          showCreateWalletModal={showCreateWalletModal}
          handleCloseCreateWalletModal={handleCloseCreateWalletModal}
          doesWalletExist={doesWalletExist}
          isLoading={isLoading}
          onContractApprove={onContractApprove}
          onCreateWalletButtonClick={onCreateWalletButtonClick}
          onContractReject={onContractReject}
        />
      );
    case ContractStatus.Approved:
      return (
        <Callout.Root className="w-full" color="teal">
          <Callout.Icon>
            <FontAwesomeIcon icon={faInfoCircle} className="h-4 w-4" />
          </Callout.Icon>
          <Callout.Text>
            Waiting for borrower to fund the contract. Please refresh to check for updates or wait for email
            notification.
          </Callout.Text>
        </Callout.Root>
      );
    case ContractStatus.CollateralSeen:
    case ContractStatus.CollateralConfirmed:
      return (
        <div>
          <RepaymentDetails
            contract={contract}
            isLoading={isLoading}
            onPrincipalGiven={onPrincipalGiven}
            txid={txid}
            setTxId={setTxid}
          />
        </div>
      );
    case ContractStatus.PrincipalGiven:
      return (
        <Alert variant="info">
          <FontAwesomeIcon icon={faInfoCircle} className="h-4 w-4 mr-2" />
          Please wait until the borrower repays the loan
        </Alert>
      );
    case ContractStatus.RepaymentProvided:
      return (
        <div>
          <Row className="mt-3">
            <Col>
              <Button onClick={onMarkAsRepaid} disabled={isLoading}>
                {isLoading
                  ? (
                    <Spinner
                      animation="border"
                      role="status"
                      variant="light"
                      size="sm"
                    >
                      <span className="visually-hidden">Loading...</span>
                    </Spinner>
                  )
                  : (
                    "Accept as repaid"
                  )}
              </Button>
            </Col>
          </Row>
        </div>
      );
    case ContractStatus.RepaymentConfirmed:
      return (
        <Alert variant="info">
          <FontAwesomeIcon icon={faInfoCircle} className="h-4 w-4 mr-2" />
          Waiting for user to withdraw funds.
        </Alert>
      );
    case ContractStatus.Closed:
    case ContractStatus.Closing:
    case ContractStatus.Rejected:
    default:
      return "";
  }
};
