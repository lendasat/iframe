import type { Contract } from "@frontend-monorepo/http-client-borrower";
import {
  ContractStatus,
  contractStatusToLabelString,
  LiquidationStatus,
  useAuth,
  useBorrowerHttpClient,
} from "@frontend-monorepo/http-client-borrower";
import { ChatDrawer } from "@frontend-monorepo/nostr-chat";
import {
  CurrencyFormatter,
  formatCurrency,
  getFormatedStringFromDays,
  InterestRateInfoLabel,
  LiquidationPriceInfoLabel,
  LtvInfoLabel,
  LtvProgressBar,
  newFormatCurrency,
  ONE_YEAR,
  RefundAddressInfoLabel,
  StableCoinHelper,
} from "@frontend-monorepo/ui-shared";
import { TransactionList, TransactionType } from "@frontend-monorepo/ui-shared";
import { ExternalLinkIcon } from "@radix-ui/react-icons";
import { Badge, Box, Button, Callout, Flex, Grid, Heading, IconButton, Separator, Text } from "@radix-ui/themes";
import { Suspense, useState } from "react";
import { OverlayTrigger, Tooltip } from "react-bootstrap";
import { FaInfoCircle } from "react-icons/fa";
import { FaCopy } from "react-icons/fa6";
import { IoMdCloudDownload } from "react-icons/io";
import { Await, Link, useParams } from "react-router-dom";
import { Lender } from "../request-loan/lender";
import { AddCollateralModal } from "./add-collateral-modal";
import { collateralForStatus } from "./collateralForStatus";
import { CollateralContractDetails } from "./collateralize-contract";
import { CollateralSeenOrConfirmed } from "./contract-collateral-seen-or-confirmed";
import { ContractDefaulted } from "./contract-defaulted";
import { ContractPrincipalGiven } from "./contract-principal-given";
import { ContractPrincipalRepaid } from "./contract-principal-repaid";
import { ContractRepaid } from "./contract-repaid";
import { ContractRequested } from "./contract-requested";
import { ContractUndercollateralized } from "./contract-undercollateralized";
import { ExpandableDisputeCard } from "./dispute-card";
import { downloadLocalStorage } from "./download-local-storage";

function ContractDetailsOverview() {
  const { innerHeight } = window;
  const { getContract } = useBorrowerHttpClient();
  const { id } = useParams();

  return (
    <Suspense>
      <Await
        resolve={id ? getContract(id) : null}
        errorElement={<div className={"text-font dark:text-font-dark"}>Could not load contracts</div>}
        children={(contract: Awaited<Contract>) => (
          <Box
            style={{
              overflowY: "scroll",
              height: innerHeight - 100,
            }}
            className={"dark:bg-dark"}
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
  const collateralSats = collateralForStatus(
    contract.status,
    contract.initial_collateral_sats,
    // The field `collateral_sats` includes the origination fee. But here we want to use the
    // collateral as it pertains to the contract between borrower and lender.
    contract.collateral_sats - contract.origination_fee_sats,
  );
  const collateralBtc = collateralSats / 100000000;

  const loanAmount = contract.loan_amount;
  const contractAddress = contract.contract_address;

  const originationFeeBtc = contract.origination_fee_sats / 100000000;
  const totalCollateral = (collateralBtc + originationFeeBtc).toFixed(8);

  const accruedInterest = contract.loan_amount
    * ((contract.interest_rate / ONE_YEAR) * contract.duration_days);
  const totalRepaymentAmount = accruedInterest + loanAmount;

  // TODO: Let's calculate the initial price once, in the backend.
  const initialCollateralBtc = contract.initial_collateral_sats / 100000000;
  const initialPrice = loanAmount / (initialCollateralBtc * contract.initial_ltv);
  const loanOriginatorFeeUsd = (originationFeeBtc * initialPrice).toFixed(0);

  // Expandable Dispute Card
  const [startingDisputeLoading, setStartingDisputeLoading] = useState(false);
  const [error, setError] = useState("");
  const { startDispute } = useBorrowerHttpClient();

  const disputeInProgress = contract.status === ContractStatus.DisputeBorrowerResolved
    || contract.status === ContractStatus.DisputeLenderResolved
    || contract.status === ContractStatus.DisputeBorrowerStarted
    || contract.status === ContractStatus.DisputeLenderStarted;

  const [info, setInfo] = useState("");

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

  return (
    <Grid className="md:grid-cols-2">
      <Box className="order-1 md:order-1 border-r border-font/10 dark:border-font-dark/10">
        <ContractDetails contract={contract} />
        <ExpandableDisputeCard
          info={info}
          onStartDispute={onStartDispute}
          startingDisputeLoading={startingDisputeLoading}
          error={error}
          disputeInProgress={disputeInProgress}
        />
      </Box>

      <Box className="order-2 md:order-2 p-6 md:p-8 space-y-5">
        <ContractStatusDetails
          contract={contract}
          collateralBtc={collateralBtc}
          contractAddress={contractAddress || ""}
          totalCollateral={totalCollateral}
          interestAmount={accruedInterest}
          totalRepaymentAmount={totalRepaymentAmount}
          loanOriginatorFee={originationFeeBtc}
          loanOriginatorFeeUsd={loanOriginatorFeeUsd}
        />
      </Box>
    </Grid>
  );
}

interface DetailsProps {
  contract: Contract;
}

function ContractDetails({ contract }: DetailsProps) {
  const { backendVersion } = useAuth();

  const [showAddCollateralModal, setShowAddCollateralModal] = useState(false);

  const coin = StableCoinHelper.mapFromBackend(
    contract.loan_asset_chain,
    contract.loan_asset_type,
  );

  const collateral = collateralForStatus(
    contract.status,
    contract.initial_collateral_sats,
    // The field `collateral_sats` includes the origination fee. But here we want to use the
    // collateral as it pertains to the contract between borrower and lender.
    contract.collateral_sats - contract.origination_fee_sats,
  );

  // TODO: This is incorrect. The collateral can change throughout the lifetime of the loan.
  const collateralBtc = collateral / 100000000;
  const loanAmount = contract.loan_amount;
  const interestRate = contract.interest_rate;
  const durationDays = contract.duration_days;
  const expiry = contract.expiry.toLocaleDateString();

  const initialLtv = contract.initial_ltv;
  const initial_price = loanAmount / (collateral * initialLtv);

  const loanOriginatorFee = contract.origination_fee_sats / 100000000;
  const loanOriginatorFeeUsd = (loanOriginatorFee * initial_price).toFixed(0);

  const firstMarginCall = contract.liquidation_status === LiquidationStatus.FirstMarginCall;
  const secondMarginCall = contract.liquidation_status === LiquidationStatus.SecondMarginCall;
  const liquidated = contract.liquidation_status === LiquidationStatus.Liquidated;
  const liquidationPrice = contract.liquidation_price;

  let contractStatusLabel = contractStatusToLabelString(contract.status);
  if (firstMarginCall) {
    contractStatusLabel = "First Margin Call";
  }
  if (secondMarginCall) {
    contractStatusLabel = "Second Margin Call";
  }
  if (liquidated) {
    contractStatusLabel = "Liquidated";
  }

  const handleCloseAddCollateralModal = () => setShowAddCollateralModal(false);
  const handleOpenAddCollateralModal = () => setShowAddCollateralModal(true);

  let canAddExtraCollateral;
  switch (contract.status) {
    case ContractStatus.CollateralSeen:
    case ContractStatus.CollateralConfirmed:
    case ContractStatus.PrincipalGiven:
    case ContractStatus.DisputeBorrowerStarted:
    case ContractStatus.DisputeLenderStarted:
    case ContractStatus.DisputeBorrowerResolved:
    case ContractStatus.DisputeLenderResolved:
      canAddExtraCollateral = true;
      break;
    case ContractStatus.Requested:
    case ContractStatus.RenewalRequested:
    case ContractStatus.Approved:
    case ContractStatus.Rejected:
    case ContractStatus.RepaymentProvided:
    case ContractStatus.RepaymentConfirmed:
    case ContractStatus.Undercollateralized:
    case ContractStatus.Defaulted:
    case ContractStatus.Closing:
    case ContractStatus.Closed:
    case ContractStatus.Extended:
    case ContractStatus.Cancelled:
    case ContractStatus.RequestExpired:
      canAddExtraCollateral = false;
      break;
  }

  const actualInterestUsdAmount = (loanAmount * interestRate) / (ONE_YEAR / durationDays);

  const [contractIdCopied, setContractIdCopied] = useState<boolean>(false);

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

  const hasParent = contract.extends_contract !== undefined && contract.extends_contract !== null;
  const hasChild = contract.extended_by_contract !== undefined && contract.extended_by_contract !== null;

  const actualInterest = contract.interest_rate / (ONE_YEAR / contract.duration_days);

  return (
    <Box>
      <ChatDrawer
        contractId={contract.id}
        counterpartyXPub={contract.lender_xpub}
      />

      <Box className="p-6 md:pl-8 border-b border-font/10 dark:border-font-dark/10">
        <Heading className={"text-font dark:text-font-dark"} size={"6"}>Contract Details</Heading>
      </Box>

      {contract.contract_address
        ? (
          <AddCollateralModal
            show={showAddCollateralModal}
            address={contract.contract_address}
            handleClose={handleCloseAddCollateralModal}
          />
        )
        : null}

      <Box className="p-6 md:p-8 space-y-5">
        <Flex gap={"5"} align={"start"} justify={"between"}>
          <Text size={"2"} weight={"medium"} className="text-font/70 dark:text-font-dark/70 shrink-0">
            Lender
          </Text>
          <Lender {...contract.lender} showAvatar={false} />
        </Flex>
        <Separator size={"4"} className="bg-font/10 dark:bg-font-dark/10" />
        <Flex gap={"5"} align={"start"} justify={"between"}>
          <Text size={"2"} weight={"medium"} className="text-font/70 dark:text-font-dark/70 shrink-0">
            Contract ID
          </Text>
          {contractIdCopied
            ? (
              <Text size={"2"} className="font-medium text-font dark:text-font-dark" color="green">
                Copied
              </Text>
            )
            : (
              <Text
                onClick={() => handleCopy(contract.id)}
                size={"2"}
                weight={"medium"}
                className="text-end cursor-copy hover:opacity-70 flex items-center gap-1 text-font dark:text-font-dark"
              >
                {formatId(contract.id)} <FaCopy />
              </Text>
            )}
        </Flex>
        <Separator size={"4"} className="bg-font/10 dark:bg-font-dark/10" />

        <Flex gap={"5"} align={"center"} justify={"between"}>
          <Text size={"2"} weight={"medium"} className="text-font/70 dark:text-font-dark/70">
            Contract Status
          </Text>
          <div className="flex flex-col">
            <Text className={"text-font dark:text-font-dark"} size={"2"} weight={"medium"}>
              <Badge
                color={contract.status === ContractStatus.Requested
                    || contract.status === ContractStatus.RenewalRequested
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
          </div>
        </Flex>
        <Separator size={"4"} className="bg-font/10 dark:bg-font-dark/10" />

        {hasParent
          && (
            <>
              <Flex gap={"5"} align={"center"} justify={"between"}>
                <Text size={"2"} weight={"medium"} className="text-font/70 dark:text-font-dark/70">
                  Old contract
                </Text>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1">
                    <Text size={"2"}>
                      <Link to={`/my-contracts/${contract.extends_contract}`}>Replaces</Link>
                    </Text>
                    <ExternalLinkIcon />
                  </div>
                </div>
              </Flex>
              <Separator size={"4"} className="bg-font/10 dark:bg-font-dark/10" />
            </>
          )}
        {hasChild
          && (
            <>
              <Flex gap={"5"} align={"center"} justify={"between"}>
                <Text size={"2"} weight={"medium"} className="text-font/70 dark:text-font-dark/70">
                  Replaced by
                </Text>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1">
                    <Text size={"2"}>
                      <Link to={`/my-contracts/${contract.extended_by_contract}`}>Replaced by</Link>
                    </Text>
                    <ExternalLinkIcon />
                  </div>
                </div>
              </Flex>
              <Separator size={"4"} className="bg-font/10 dark:bg-font-dark/10" />
            </>
          )}

        <Flex gap={"5"} align={"start"} justify={"between"}>
          <Text size={"2"} weight={"medium"} className="text-font/70 dark:text-font-dark/70">
            Loan Amount
          </Text>
          <Text className={"text-font dark:text-font-dark"} size={"2"} weight={"medium"}>
            <CurrencyFormatter value={loanAmount} />
          </Text>
        </Flex>
        <Separator size={"4"} className="bg-font/10 dark:bg-font-dark/10" />

        <Flex gap={"5"} align={"start"} justify={"between"}>
          <Text size={"2"} weight={"medium"} className="text-font/70 dark:text-font-dark/70">
            Asset
          </Text>
          <Text className={"text-font dark:text-font-dark"} size={"2"} weight={"medium"}>
            <Text>
              <Badge>{coin ? StableCoinHelper.print(coin) : ""}</Badge>
            </Text>
          </Text>
        </Flex>
        <Separator size={"4"} className="bg-font/10 dark:bg-font-dark/10" />

        <Flex gap={"5"} align={"start"} justify={"between"}>
          <Text size={"2"} weight={"medium"} className="text-font/70 dark:text-font-dark/70">
            Duration
          </Text>
          <Text className={"text-font dark:text-font-dark"} size={"2"} weight={"medium"}>
            {getFormatedStringFromDays(durationDays)}
          </Text>
        </Flex>
        <Separator size={"4"} className="bg-font/10 dark:bg-font-dark/10" />

        <Flex gap={"5"} align={"start"} justify={"between"}>
          <Text size={"2"} weight={"medium"} className="text-font/70 dark:text-font-dark/70">
            Expiry
          </Text>
          <Text className={"text-font dark:text-font-dark"} size={"2"} weight={"medium"}>
            {expiry}
          </Text>
        </Flex>
        <Separator size={"4"} className="bg-font/10 dark:bg-font-dark/10" />

        <Flex gap={"5"} align={"start"} justify={"between"}>
          <Flex align={"center"} gap={"1"}>
            <Text size={"2"} weight={"medium"} className="text-font/70 dark:text-font-dark/70">
              Collateral
            </Text>
            {canAddExtraCollateral && (
              <IconButton onClick={handleOpenAddCollateralModal} size={"2"}>
                +
              </IconButton>
            )}
          </Flex>
          <Text className={"text-font dark:text-font-dark"} size={"2"} weight={"medium"}>
            {collateralBtc.toFixed(8)} BTC
          </Text>
        </Flex>
        <Separator size={"4"} className="bg-font/10 dark:bg-font-dark/10" />

        <Flex gap={"5"} align={"start"} justify={"between"}>
          <Text size={"2"} weight={"medium"} className="text-font/70 dark:text-font-dark/70">
            {/* TODO: here we showed the percentage as well, but we don't know the number :) */}
            Origination Fee
          </Text>
          <Box className="max-w-sm text-end">
            <OverlayTrigger
              placement="top"
              overlay={<Tooltip>${loanOriginatorFeeUsd}</Tooltip>}
            >
              <Text className={"text-font dark:text-font-dark"} size={"2"} weight={"medium"}>
                {loanOriginatorFee.toFixed(8)} BTC
              </Text>
            </OverlayTrigger>
          </Box>
        </Flex>
        <Separator size={"4"} className="bg-font/10 dark:bg-font-dark/10" />

        <Flex gap={"5"} align={"start"} justify={"between"}>
          <LtvInfoLabel>
            <Text size={"2"} weight={"medium"} className="text-font/70 dark:text-font-dark/70">
              LTV Ratio
            </Text>
            <FaInfoCircle className={"text-font dark:text-font-dark"} />
          </LtvInfoLabel>

          <div className="w-40 ml-auto">
            <LtvProgressBar loanAmount={loanAmount} collateralBtc={collateralBtc} />
          </div>
        </Flex>

        <Separator size={"4"} className="bg-font/10 dark:bg-font-dark/10" />
        <Flex justify={"between"} align={"center"}>
          <LiquidationPriceInfoLabel>
            <Flex align={"center"} gap={"2"} className="text-font dark:text-font-dark">
              <Text size={"2"} weight={"medium"} className="text-font/70 dark:text-font-dark/70">
                Liquidation Price
              </Text>
              <FaInfoCircle />
            </Flex>
          </LiquidationPriceInfoLabel>
          <div className="flex flex-col">
            <Text className="text-[13px] font-semibold text-font/70 dark:text-font-dark/70 capitalize">
              {newFormatCurrency({ value: liquidationPrice, maxFraction: 0, minFraction: 1 })}
            </Text>
          </div>
        </Flex>
        <Separator size={"4"} className="bg-font/10 dark:bg-font-dark/10" />

        <Flex gap={"5"} align={"start"} justify={"between"}>
          <InterestRateInfoLabel>
            <Flex align={"center"} gap={"2"}>
              <Text size={"2"} weight={"medium"} className="text-font/70 dark:text-font-dark/70">
                Interest Rate
              </Text>
              <FaInfoCircle className={"text-font dark:text-font-dark"} />
            </Flex>
          </InterestRateInfoLabel>
          <div className="flex flex-col">
            {contract.duration_days !== ONE_YEAR
              && (
                <Flex gap={"2"}>
                  <Text className="text-[13px] font-semibold text-font/70 dark:text-font-dark/70">
                    {(actualInterest * 100).toFixed(2)}%
                  </Text>
                  <Text className="text-[11px] text-font/70 dark:text-font-dark/50 mt-0.5 self-end">
                    ({(contract.interest_rate * 100).toFixed(1)}% p.a.)
                  </Text>
                </Flex>
              )}
            {contract.duration_days === ONE_YEAR
              && (
                <Text className="text-[13px] font-semibold text-font/70 dark:text-font-dark/70">
                  {(actualInterest * 100).toFixed(2)}% p.a.
                </Text>
              )}
            <Text className="text-[11px] text-font/50 dark:text-font-dark/50 mt-0.5 self-end">
              ≈ {formatCurrency(actualInterestUsdAmount, 1, 1)} in total
            </Text>

            {
              /*
            <Text className={"text-font dark:text-font-dark"} size={"2"} weight={"medium"}>
              {(interestRate * 100).toFixed(2)}% per year
            </Text>
            <Text className="text-[11px] text-font/50 dark:text-font-dark/50 mt-0.5 self-end">
              ≈ {formatCurrency(actualInterestUsdAmount, 1, 1)} in total
            </Text>
          */
            }
          </div>
        </Flex>
        <Separator size={"4"} className="bg-font/10 dark:bg-font-dark/10" />

        <Flex gap={"5"} align={"start"} justify={"between"}>
          <RefundAddressInfoLabel>
            <Flex align={"center"} gap={"2"}>
              <Text size={"2"} weight={"medium"} className="text-font/70 dark:text-font-dark/70">
                Collateral Refund Address
              </Text>
              <FaInfoCircle className={"text-font dark:text-font-dark"} />
            </Flex>
          </RefundAddressInfoLabel>
          {contractIdCopied
            ? (
              <Text size={"2"} className="font-medium text-font dark:text-font-dark" color="green">
                Copied
              </Text>
            )
            : (
              <Text
                onClick={() => handleCopy(contract.borrower_btc_address)}
                size={"2"}
                weight={"medium"}
                className="text-end cursor-copy hover:opacity-70 flex items-center gap-1 text-font dark:text-font-dark"
              >
                {formatId(contract.borrower_btc_address)} <FaCopy />
              </Text>
            )}
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
            className="bg-btn dark:bg-dark-600"
            onClick={() => downloadLocalStorage(backendVersion)}
          >
            <IoMdCloudDownload />
            Download
          </Button>
        </Flex>
      </Box>
    </Box>
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
  collateralBtc: number;
  totalCollateral: string;
  contractAddress: string;
  interestAmount: number;
  totalRepaymentAmount: number;
  loanOriginatorFee: number;
  loanOriginatorFeeUsd: string;
}

const ContractStatusDetails = ({
  contract,
  collateralBtc,
  totalCollateral,
  contractAddress,
  interestAmount,
  totalRepaymentAmount,
  loanOriginatorFee,
  loanOriginatorFeeUsd,
}: ContractStatusDetailsProps) => {
  switch (contract.status) {
    case ContractStatus.Requested:
    case ContractStatus.RenewalRequested:
      return <ContractRequested createdAt={contract.created_at} contractId={contract.id} />;
    case ContractStatus.Approved:
      return (
        <CollateralContractDetails
          totalCollateral={totalCollateral}
          collateralAddress={contractAddress}
          collateral_btc={contract.initial_collateral_sats / 100000000}
          loanOriginatorFeeUsd={loanOriginatorFeeUsd}
          loanOriginatorFee={loanOriginatorFee}
        />
      );
    case ContractStatus.CollateralSeen:
    case ContractStatus.CollateralConfirmed:
      return (
        <CollateralSeenOrConfirmed
          collateral={totalCollateral}
          collateralAddress={contractAddress}
          contract={contract}
        />
      );
    case ContractStatus.PrincipalGiven: {
      return (
        <ContractPrincipalGiven
          interestAmount={interestAmount}
          totalRepaymentAmount={totalRepaymentAmount}
          contract={contract}
        />
      );
    }
    case ContractStatus.RepaymentProvided:
      return <ContractPrincipalRepaid />;
    case ContractStatus.RepaymentConfirmed:
      return <ContractRepaid contract={contract} collateralBtc={collateralBtc} />;
    case ContractStatus.Undercollateralized:
      return <ContractUndercollateralized />;
    case ContractStatus.Defaulted:
      return <ContractDefaulted />;
    case ContractStatus.Closed:
    case ContractStatus.Extended:
    case ContractStatus.Closing:
    case ContractStatus.Rejected:
    case ContractStatus.RequestExpired:
    case ContractStatus.DisputeBorrowerStarted:
    case ContractStatus.DisputeLenderStarted:
    case ContractStatus.DisputeBorrowerResolved:
    case ContractStatus.DisputeLenderResolved:
    case ContractStatus.Cancelled:
      return "";
  }
};
