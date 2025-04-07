import {
  faExclamationCircle,
  faInfoCircle,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { Contract } from "@frontend/http-client-lender";
import {
  ContractStatus,
  contractStatusToLabelString,
  LiquidationStatus,
  TransactionType,
  useAuth,
  useLenderHttpClient,
} from "@frontend/http-client-lender";
import { ChatDrawer } from "@frontend/nostr-chat";
import {
  CurrencyFormatter,
  formatCurrency,
  getFormatedStringFromDays,
  InterestRateInfoLabel,
  LiquidationPriceInfoLabel,
  LoanAssetHelper,
  LtvInfoLabel,
  newFormatCurrency,
  ONE_YEAR,
  TransactionList,
} from "@frontend/ui-shared";
import { ExternalLinkIcon } from "@radix-ui/react-icons";
import {
  Badge,
  Box,
  Button,
  Callout,
  Flex,
  Grid,
  Heading,
  Separator,
  Text,
} from "@radix-ui/themes";
import { Suspense, useState } from "react";
import { Alert, Col, Row, Spinner } from "react-bootstrap";
import { FaCopy, FaInfoCircle } from "react-icons/fa";
import { IoMdCloudDownload } from "react-icons/io";
import { Await, Link, useNavigate, useParams } from "react-router-dom";
import { ExpandableDisputeCard } from "../disputes/dispute-card";
import { Borrower } from "./borrower";
import { ContractDefaulted } from "./contract-defaulted";
import { ContractPendingKyc } from "./contract-pending-kyc";
import { ContractRecovery } from "./contract-recovery";
import { ContractRequested } from "./contract-requested";
import { ContractUndercollateralized } from "./contract-undercollateralized";
import { downloadContractBackup } from "./download-contract-backup";
import LoanPrincipalStablecoinPayout from "./pay-loan-principal-stablecoin";
import { FiatLoanDetails } from "@frontend/base-http-client";
import RepaymentDetailsFiat from "./pay-loan-principal-fiat";

function ContractDetailsOverview() {
  const { innerHeight } = window;
  const { getContract } = useLenderHttpClient();
  const { id } = useParams();

  return (
    <Suspense>
      <Await
        resolve={id ? getContract(id) : null}
        errorElement={
          <div className={"text-font dark:text-font-dark"}>
            Could not load contracts
          </div>
        }
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
  const { startDispute, newChatNotification } = useLenderHttpClient();
  const { backendVersion } = useAuth();

  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [startingDisputeLoading, setStartingDisputeLoading] = useState(false);

  const collateral_sats = contract.collateral_sats;
  const collateral = collateral_sats / 100000000;
  const loanAmount = contract.loan_amount;
  const durationDays = contract.duration_days;

  const interestRate = contract.interest_rate;

  const initialLtv = contract.initial_ltv;

  const initialLtvFormatted = (initialLtv * 100).toFixed(0);

  const disputeInProgress =
    contract.status === ContractStatus.DisputeBorrowerResolved ||
    contract.status === ContractStatus.DisputeLenderResolved ||
    contract.status === ContractStatus.DisputeBorrowerStarted ||
    contract.status === ContractStatus.DisputeLenderStarted;

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
  const firstMarginCall =
    contract.liquidation_status === LiquidationStatus.FirstMarginCall;
  const secondMarginCall =
    contract.liquidation_status === LiquidationStatus.SecondMarginCall;
  const liquidated =
    contract.liquidation_status === LiquidationStatus.Liquidated;
  const liquidationPrice = contract.liquidation_price;

  if (firstMarginCall) {
    contractStatusLabel = "First Margin Call";
  }
  if (secondMarginCall) {
    contractStatusLabel = "Second Margin Call";
  }
  if (liquidated) {
    contractStatusLabel = "Liquidated";
  }

  const actualInterestUsdAmount =
    (loanAmount * interestRate) / (ONE_YEAR / durationDays);
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

  const displayDispute =
    contract.status !== ContractStatus.Requested &&
    contract.status !== ContractStatus.Approved;

  const loanAsset = contract.loan_asset;

  const hasParent =
    contract.extends_contract !== undefined &&
    contract.extends_contract !== null;
  const hasChild =
    contract.extended_by_contract !== undefined &&
    contract.extended_by_contract !== null;

  return (
    <Grid className="md:grid-cols-2">
      <ChatDrawer
        contractId={contract.id}
        counterpartyXPub={contract.borrower_xpub}
        onNewMsgSent={async () => {
          await newChatNotification({
            contract_id: contract.id,
          });
        }}
      />
      <Box className="border-font/10 dark:border-font-dark/10 border-r">
        <Box className="border-font/10 dark:border-font-dark/10 border-b p-6 md:pl-8">
          <Heading className={"text-font dark:text-font-dark"} size={"6"}>
            Contract Details
          </Heading>
        </Box>
        <Box className="space-y-5 p-6 md:p-8">
          <Flex gap={"5"} align={"start"} justify={"between"}>
            <Text
              size={"2"}
              weight={"medium"}
              className="text-font/70 dark:text-font-dark/70 shrink-0"
            >
              Borrower
            </Text>
            <Box className="max-w-sm text-end">
              <div className="flex flex-col">
                <Text
                  size={"2"}
                  weight={"medium"}
                  className="text-font dark:text-font-dark break-all"
                >
                  <Borrower {...contract.borrower} showAvatar={false} />
                </Text>
              </div>
            </Box>
          </Flex>
          <Separator size={"4"} className="bg-font/10 dark:bg-font-dark/10" />

          <Flex gap={"5"} align={"start"} justify={"between"}>
            <Text
              size={"2"}
              weight={"medium"}
              className="text-font/70 dark:text-font-dark/70 shrink-0"
            >
              Contract ID
            </Text>
            {contractIdCopied ? (
              <Text
                size={"2"}
                className="text-font dark:text-font-dark font-medium"
                color="green"
              >
                Copied
              </Text>
            ) : (
              <Text
                onClick={() => handleCopy(contract.id)}
                size={"2"}
                weight={"medium"}
                className="text-font dark:text-font-dark flex cursor-copy items-center gap-1 text-end hover:opacity-70"
              >
                {formatId(contract.id)}{" "}
                <FaCopy className={"text-font dark:text-font-dark"} />
              </Text>
            )}
          </Flex>
          <Separator size={"4"} className="bg-font/10 dark:bg-font-dark/10" />

          <Flex gap={"5"} align={"center"} justify={"between"}>
            <Text
              size={"2"}
              weight={"medium"}
              className="text-font/70 dark:text-font-dark/70"
            >
              Contract status
            </Text>
            <div className="flex flex-col">
              <Text
                className={"text-font dark:text-font-dark"}
                size={"2"}
                weight={"medium"}
              >
                <Box className="flex flex-row space-x-2">
                  <Badge
                    color={
                      contract.status === ContractStatus.Requested ||
                      contract.status === ContractStatus.RenewalRequested
                        ? "amber"
                        : contract.status === ContractStatus.Approved
                          ? "green"
                          : contract.status === ContractStatus.Rejected
                            ? "red"
                            : "gray"
                    }
                    size={"2"}
                  >
                    {contractStatusLabel}
                  </Badge>
                  {contract.kyc_info && !contract.kyc_info.is_kyc_done && (
                    <Badge color="gray" size="2">
                      KYC Pending
                    </Badge>
                  )}
                </Box>
              </Text>
            </div>
          </Flex>
          <Separator size={"4"} className="bg-font/10 dark:bg-font-dark/10" />

          {hasParent && (
            <>
              <Flex gap={"5"} align={"center"} justify={"between"}>
                <Text
                  size={"2"}
                  weight={"medium"}
                  className="text-font/70 dark:text-font-dark/70"
                >
                  Old contract
                </Text>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1">
                    <Text size={"2"}>
                      <Link to={`/my-contracts/${contract.extends_contract}`}>
                        Replaces
                      </Link>
                    </Text>
                    <ExternalLinkIcon />
                  </div>
                </div>
              </Flex>
              <Separator
                size={"4"}
                className="bg-font/10 dark:bg-font-dark/10"
              />
            </>
          )}
          {hasChild && (
            <>
              <Flex gap={"5"} align={"center"} justify={"between"}>
                <Text
                  size={"2"}
                  weight={"medium"}
                  className="text-font/70 dark:text-font-dark/70"
                >
                  Replaced by
                </Text>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1">
                    <Text size={"2"}>
                      <Link
                        to={`/my-contracts/${contract.extended_by_contract}`}
                      >
                        Replaced by
                      </Link>
                    </Text>
                    <ExternalLinkIcon />
                  </div>
                </div>
              </Flex>
              <Separator
                size={"4"}
                className="bg-font/10 dark:bg-font-dark/10"
              />
            </>
          )}

          <Flex gap={"5"} align={"start"} justify={"between"}>
            <Text
              size={"2"}
              weight={"medium"}
              className="text-font/70 dark:text-font-dark/70"
            >
              Loan Amount
            </Text>
            <Text
              className={"text-font dark:text-font-dark"}
              size={"2"}
              weight={"medium"}
            >
              <CurrencyFormatter value={loanAmount} />
            </Text>
          </Flex>
          <Separator size={"4"} className="bg-font/10 dark:bg-font-dark/10" />

          <Flex gap={"5"} align={"start"} justify={"between"}>
            <Text
              size={"2"}
              weight={"medium"}
              className="text-font/70 dark:text-font-dark/70"
            >
              Asset
            </Text>
            <Text
              className={"text-font dark:text-font-dark"}
              size={"2"}
              weight={"medium"}
            >
              <Text>
                <Badge>{LoanAssetHelper.print(loanAsset)}</Badge>
              </Text>
            </Text>
          </Flex>
          <Separator size={"4"} className="bg-font/10 dark:bg-font-dark/10" />

          <Flex gap={"5"} align={"start"} justify={"between"}>
            <Text
              size={"2"}
              weight={"medium"}
              className="text-font/70 dark:text-font-dark/70"
            >
              Duration
            </Text>
            <Text
              className={"text-font dark:text-font-dark"}
              size={"2"}
              weight={"medium"}
            >
              {getFormatedStringFromDays(durationDays)}
            </Text>
          </Flex>
          <Separator size={"4"} className="bg-font/10 dark:bg-font-dark/10" />

          <Flex gap={"5"} align={"start"} justify={"between"}>
            <Text
              size={"2"}
              weight={"medium"}
              className="text-font/70 dark:text-font-dark/70"
            >
              Expiry
            </Text>
            <Text
              className={"text-font dark:text-font-dark"}
              size={"2"}
              weight={"medium"}
            >
              {contract.expiry.toLocaleDateString([], {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </Text>
          </Flex>
          <Separator size={"4"} className="bg-font/10 dark:bg-font-dark/10" />

          <Flex gap={"5"} align={"start"} justify={"between"}>
            <Text
              size={"2"}
              weight={"medium"}
              className="text-font/70 dark:text-font-dark/70"
            >
              Collateral
            </Text>
            <Text
              className={"text-font dark:text-font-dark"}
              size={"2"}
              weight={"medium"}
            >
              {collateral.toFixed(8)} BTC
            </Text>
          </Flex>
          <Separator size={"4"} className="bg-font/10 dark:bg-font-dark/10" />

          <Flex justify={"between"} align={"center"}>
            <LiquidationPriceInfoLabel>
              <Flex
                align={"center"}
                gap={"2"}
                className="text-font dark:text-font-dark"
              >
                <Text
                  size={"2"}
                  weight={"medium"}
                  className="text-font/70 dark:text-font-dark/70"
                >
                  Liquidation Price
                </Text>
                <FaInfoCircle />
              </Flex>
            </LiquidationPriceInfoLabel>
            <div className="flex flex-col">
              <Text className="text-font/70 dark:text-font-dark/70 text-[13px] font-semibold capitalize">
                {newFormatCurrency({
                  value: liquidationPrice,
                  maxFraction: 0,
                  minFraction: 1,
                })}
              </Text>
            </div>
          </Flex>
          <Separator size={"4"} className="bg-font/10 dark:bg-font-dark/10" />

          <Flex gap={"5"} align={"start"} justify={"between"}>
            <LtvInfoLabel>
              <Text
                size={"2"}
                weight={"medium"}
                className="text-font/70 dark:text-font-dark/70"
              >
                Initial LTV ratio
              </Text>
              <FaInfoCircle className="text-font dark:text-font-dark" />
            </LtvInfoLabel>
            <Text
              className={"text-font dark:text-font-dark"}
              size={"2"}
              weight={"medium"}
            >
              {initialLtvFormatted}%
            </Text>
          </Flex>
          <Separator size={"4"} className="bg-font/10 dark:bg-font-dark/10" />

          <Flex gap={"5"} align={"start"} justify={"between"}>
            <InterestRateInfoLabel>
              <Flex
                align={"center"}
                gap={"2"}
                className="text-font dark:text-font-dar"
              >
                <Text
                  size={"2"}
                  weight={"medium"}
                  className="text-font/70 dark:text-font-dark/70"
                >
                  Interest Rate
                </Text>
                <FaInfoCircle className={"text-font dark:text-font-dark"} />
              </Flex>
            </InterestRateInfoLabel>

            <div className="flex flex-col">
              <Text
                className={"text-font dark:text-font-dark"}
                size={"2"}
                weight={"medium"}
              >
                {(interestRate * 100).toFixed(2)}% per year
              </Text>
              <Text className="text-font/50 dark:text-font-dark/50 mt-0.5 self-end text-[11px]">
                ≈ {formatCurrency(actualInterestUsdAmount, 1, 1)} in total
              </Text>
            </div>
          </Flex>
          <Separator size={"4"} className="bg-font/10 dark:bg-font-dark/10" />
          <AdditionalDetail contract={contract} />
          <Callout.Root>
            <Callout.Icon>
              <IoMdCloudDownload size={"18"} />
            </Callout.Icon>
            <Callout.Text>
              Download contract backup. It is encrypted with your password.
            </Callout.Text>
          </Callout.Root>
          <Flex align={"center"} justify={"end"}>
            <Button
              size="3"
              className="bg-btn dark:bg-dark-600 text-white"
              onClick={() => downloadContractBackup(backendVersion, contract)}
            >
              <IoMdCloudDownload />
              Download
            </Button>
          </Flex>

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
      </Box>
      <Box className="space-y-5 p-6 md:p-8">
        <ContractStatusDetails
          contract={contract}
          onError={onError}
          onSuccess={onSuccess}
        />

        {errorAlt && (
          <Callout.Root color="red">
            <Callout.Icon>
              <FontAwesomeIcon icon={faExclamationCircle} className="h-4 w-4" />
            </Callout.Icon>
            <Callout.Text>{errorAlt}</Callout.Text>
          </Callout.Root>
        )}
      </Box>
    </Grid>
  );
}

interface AdditionalDetailsProps {
  contract: Contract;
}

const AdditionalDetail = ({ contract }: AdditionalDetailsProps) => {
  return (
    <>
      <TransactionList
        contract={contract}
        transactionType={TransactionType.Funding}
      />
      <TransactionList
        contract={contract}
        transactionType={TransactionType.PrincipalGiven}
      />
      <TransactionList
        contract={contract}
        transactionType={TransactionType.PrincipalRepaid}
      />
      <TransactionList
        contract={contract}
        transactionType={TransactionType.ClaimCollateral}
      />
      <TransactionList
        contract={contract}
        transactionType={TransactionType.Liquidation}
      />
    </>
  );
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
  const {
    approveKyc,
    rejectKyc,
    approveContract,
    rejectContract,
    principalGiven,
    markPrincipalConfirmed,
  } = useLenderHttpClient();
  const [isLoading, setIsLoading] = useState(false);
  const [txid, setTxid] = useState("");

  const onKycApprove = async () => {
    try {
      setIsLoading(true);
      await approveKyc(contract.borrower.id);
      // We do not automatically approve the contract, because the lender may yet want to reject
      // this particular offer.
      onSuccess();
    } catch (error) {
      onError(`${error}`);
    } finally {
      setIsLoading(false);
    }
  };
  const onKycReject = async () => {
    try {
      setIsLoading(true);
      await rejectKyc(contract.borrower.id);
      // We also reject the contract, since the borrower could not KYC.
      await rejectContract(contract.id);
      onSuccess();
    } catch (error) {
      onError(`${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const onContractApprove = async (fiatTransferDetails?: FiatLoanDetails) => {
    try {
      setIsLoading(true);

      await approveContract(contract.id, fiatTransferDetails);
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

  if (contract.can_recover_collateral_manually) {
    return <ContractRecovery contract={contract} />;
  }

  switch (contract.status) {
    case ContractStatus.Requested: {
      if (contract.kyc_info && !contract.kyc_info.is_kyc_done) {
        return (
          <ContractPendingKyc
            isLoading={isLoading}
            onKycApprove={onKycApprove}
            onKycReject={onKycReject}
            kycLink={contract.kyc_info.kyc_link}
          />
        );
      } else {
        return (
          <ContractRequested
            borrowerXpub={contract.borrower_xpub}
            loanAsset={contract.loan_asset}
            isLoading={isLoading}
            onContractApprove={(a) => onContractApprove(a)}
            onContractReject={onContractReject}
          />
        );
      }
    }
    case ContractStatus.RenewalRequested:
      return (
        <ContractRequested
          borrowerXpub={contract.borrower_xpub}
          loanAsset={contract.loan_asset}
          isLoading={isLoading}
          onContractApprove={onContractApprove}
          onContractReject={onContractReject}
        />
      );
    case ContractStatus.Approved:
      return (
        <Callout.Root className="w-full" color="teal">
          <Callout.Icon>
            <FontAwesomeIcon
              icon={faInfoCircle}
              className="text-font dark:text-font-dark h-4 w-4"
            />
          </Callout.Icon>
          <Callout.Text className={"text-font dark:text-font-dark"}>
            Waiting for borrower to fund the contract. Please refresh to check
            for updates or wait for email notification.
          </Callout.Text>
        </Callout.Root>
      );
    case ContractStatus.CollateralSeen:
    case ContractStatus.CollateralConfirmed:
      return (
        <div>
          {!LoanAssetHelper.isFiat(contract.loan_asset) && (
            <LoanPrincipalStablecoinPayout
              contract={contract}
              isLoading={isLoading}
              onPrincipalGiven={onPrincipalGiven}
              txid={txid}
              setTxId={setTxid}
            />
          )}
          {LoanAssetHelper.isFiat(contract.loan_asset) && (
            <RepaymentDetailsFiat
              contract={contract}
              isLoading={isLoading}
              onPrincipalGiven={onPrincipalGiven}
            />
          )}
        </div>
      );
    case ContractStatus.PrincipalGiven:
      return (
        <Alert variant="info">
          <FontAwesomeIcon icon={faInfoCircle} className="mr-2 h-4 w-4" />
          Please wait until the borrower repays the loan.
        </Alert>
      );
    case ContractStatus.RepaymentProvided:
      return (
        <div>
          <Row className="mt-3">
            <Col>
              <Button onClick={onMarkAsRepaid} disabled={isLoading}>
                {isLoading ? (
                  <Spinner
                    animation="border"
                    role="status"
                    variant="light"
                    size="sm"
                  >
                    <span className="visually-hidden text-font dark:text-font-dark">
                      Loading...
                    </span>
                  </Spinner>
                ) : (
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
          <FontAwesomeIcon icon={faInfoCircle} className="mr-2 h-4 w-4" />
          Waiting for user to withdraw funds.
        </Alert>
      );
    case ContractStatus.Undercollateralized:
      return <ContractUndercollateralized contract={contract} />;
    case ContractStatus.Defaulted:
      return <ContractDefaulted contract={contract} />;
    case ContractStatus.Closed:
    case ContractStatus.Extended:
    case ContractStatus.Closing:
    case ContractStatus.Rejected:
    case ContractStatus.Cancelled:
    case ContractStatus.RequestExpired:
    case ContractStatus.ApprovalExpired:
    case ContractStatus.DisputeBorrowerStarted:
    case ContractStatus.DisputeLenderStarted:
    case ContractStatus.DisputeBorrowerResolved:
    case ContractStatus.DisputeLenderResolved:
  }
};
