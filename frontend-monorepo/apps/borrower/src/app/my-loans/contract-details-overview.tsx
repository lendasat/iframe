import type { Contract } from "@frontend-monorepo/http-client-borrower";
import {
  ContractStatus,
  contractStatusToLabelString,
  LiquidationStatus,
  TransactionType,
  useAuth,
  useBorrowerHttpClient,
} from "@frontend-monorepo/http-client-borrower";
import {
  AprInfoLabel,
  CurrencyFormatter,
  formatCurrency,
  LtvInfoLabel,
  StableCoinHelper,
  usePrice,
} from "@frontend-monorepo/ui-shared";
import { Badge, Box, Button, Callout, Flex, Grid, Heading, IconButton, Separator, Text } from "@radix-ui/themes";
import { Suspense, useState } from "react";
import { Col, OverlayTrigger, Row, Tooltip } from "react-bootstrap";
import { FaInfoCircle } from "react-icons/fa";
import { FaCopy } from "react-icons/fa6";
import { IoMdCloudDownload } from "react-icons/io";
import { Await, Link, useParams } from "react-router-dom";
import { AddCollateralModal } from "./add-collateral-modal";
import { collateralForStatus } from "./collateralForStatus";
import { CollateralContractDetails } from "./collateralize-contract";
import { CollateralSeenOrConfirmed } from "./contract-collateral-seen-or-confirmed";
import { ContractPrincipalGiven } from "./contract-principal-given";
import { ContractPrincipalRepaid } from "./contract-principal-repaid";
import { ContractRepaid } from "./contract-repaid";
import { ContractRequested } from "./contract-requested";
import { ExpandableDisputeCard } from "./dispute-card";
import { downloadLocalStorage } from "./download-local-storage";
import TransactionList from "./transaction-list";

function ContractDetailsOverview() {
  const { innerHeight } = window;
  const { getContract } = useBorrowerHttpClient();
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
              height: innerHeight - 100,
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
  const collateralSats = collateralForStatus(
    contract.status,
    contract.initial_collateral_sats,
    contract.collateral_sats,
  );
  const collateralBtc = collateralSats / 100000000;

  const loanAmount = contract.loan_amount;
  const contractAddress = contract.contract_address;

  const originationFeeBtc = contract.origination_fee_sats / 100000000;
  const totalCollateral = (collateralBtc + originationFeeBtc).toFixed(8);

  const accruedInterest = contract.loan_amount
    * ((contract.interest_rate / 12) * contract.duration_months);
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
      <Box className="order-1 md:order-1 border-r border-font/10">
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
  const { latestPrice } = usePrice();
  const { backendVersion } = useAuth();

  const [showAddCollateralModal, setShowAddCollateralModal] = useState(false);

  const coin = StableCoinHelper.mapFromBackend(
    contract.loan_asset_chain,
    contract.loan_asset_type,
  );

  const collateral = collateralForStatus(
    contract.status,
    contract.initial_collateral_sats,
    contract.collateral_sats,
  );
  const collateralBtc = collateral / 100000000;
  const loanAmount = contract.loan_amount;
  const interestRate = contract.interest_rate;
  const durationMonths = contract.duration_months;
  const expiry = contract.expiry.toLocaleDateString();

  const initialLtv = contract.initial_ltv;
  const initial_price = loanAmount / (collateral * initialLtv);

  const ltvRatio = loanAmount / (collateralBtc * latestPrice);
  const ltvPercentage = (ltvRatio * 100).toFixed(0);

  const loanOriginatorFee = contract.origination_fee_sats / 100000000;
  const loanOriginatorFeeUsd = (loanOriginatorFee * initial_price).toFixed(0);

  const firstMarginCall = contract.liquidation_status === LiquidationStatus.FirstMarginCall;
  const secondMarginCall = contract.liquidation_status === LiquidationStatus.SecondMarginCall;
  const liquidated = contract.liquidation_status === LiquidationStatus.Liquidated;

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
    case ContractStatus.Approved:
    case ContractStatus.Rejected:
    case ContractStatus.RepaymentProvided:
    case ContractStatus.RepaymentConfirmed:
    case ContractStatus.Closing:
    case ContractStatus.Closed:
    case ContractStatus.Cancelled:
    case ContractStatus.RequestExpired:
    default:
      canAddExtraCollateral = false;
      break;
  }

  const actualInterestUsdAmount = (loanAmount * interestRate) / (12 / durationMonths);

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

  return (
    <Box>
      <Box className="p-6 md:pl-8 border-b border-font/10">
        <Heading size={"6"}>Contract Details</Heading>
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
          <Text size={"2"} weight={"medium"} className="text-font/70 shrink-0">
            Lender
          </Text>

          <Link to={`/profile/${contract.lender.id}`}>
            <Text size={"2"} weight={"medium"} className="text-end">
              {contract.lender.name}
            </Text>
          </Link>
        </Flex>
        <Separator size={"4"} className="bg-font/10" />
        <Flex gap={"5"} align={"start"} justify={"between"}>
          <Text size={"2"} weight={"medium"} className="text-font/70 shrink-0">
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
              <Badge>{coin ? StableCoinHelper.print(coin) : ""}</Badge>
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
            Expiry
          </Text>
          <Text size={"2"} weight={"medium"}>
            {expiry}
          </Text>
        </Flex>
        <Separator size={"4"} className="bg-font/10" />

        <Flex gap={"5"} align={"start"} justify={"between"}>
          <Flex align={"center"} gap={"1"}>
            <Text size={"2"} weight={"medium"} className="text-font/70">
              Collateral
            </Text>
            {canAddExtraCollateral && (
              <IconButton onClick={handleOpenAddCollateralModal} size={"2"}>
                +
              </IconButton>
            )}
          </Flex>
          <Text size={"2"} weight={"medium"}>
            {collateralBtc.toFixed(8)} BTC
          </Text>
        </Flex>
        <Separator size={"4"} className="bg-font/10" />

        <Flex gap={"5"} align={"start"} justify={"between"}>
          <Text size={"2"} weight={"medium"} className="text-font/70">
            {/* TODO: here we showed the percentage as well, but we don't know the number :) */}
            Origination fee
          </Text>
          <Box className="max-w-sm text-end">
            <OverlayTrigger
              placement="top"
              overlay={<Tooltip>${loanOriginatorFeeUsd}</Tooltip>}
            >
              <Text size={"2"} weight={"medium"}>
                {loanOriginatorFee.toFixed(8)} BTC
              </Text>
            </OverlayTrigger>
          </Box>
        </Flex>
        <Separator size={"4"} className="bg-font/10" />

        <Flex gap={"5"} align={"start"} justify={"between"}>
          <LtvInfoLabel>
            <Text size={"2"} weight={"medium"} className="text-font/70">
              LTV ratio
            </Text>
            <FaInfoCircle />
          </LtvInfoLabel>

          <Text size={"2"} weight={"medium"}>
            {ltvPercentage}%
          </Text>
        </Flex>
        <Separator size={"4"} className="bg-font/10" />

        <Flex gap={"5"} align={"start"} justify={"between"}>
          <AprInfoLabel>
            <Flex align={"center"} gap={"2"}>
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
      </Box>
    </Box>
  );
}

interface AdditionalDetailsProps {
  contract: Contract;
}

const AdditionalDetail = ({ contract }: AdditionalDetailsProps) => {
  switch (contract.status) {
    case ContractStatus.Requested:
      break;
    case ContractStatus.Approved:
      break;
    case ContractStatus.CollateralSeen:
    case ContractStatus.CollateralConfirmed:
      return (
        <Row className="justify-content-between border-b mt-2">
          <Col>Funding transaction</Col>
          <Col className="text-end mb-2">
            <TransactionList
              contract={contract}
              transactionType={TransactionType.Funding}
            />
          </Col>
        </Row>
      );
    case ContractStatus.PrincipalGiven:
      return (
        <>
          <Row className="justify-content-between border-b mt-2">
            <Col>Funding transaction</Col>
            <Col className="text-end mb-2">
              <Col className="text-end mb-2">
                <TransactionList
                  contract={contract}
                  transactionType={TransactionType.Funding}
                />
              </Col>
            </Col>
          </Row>
          <Row className="justify-content-between border-b mt-2">
            <Col>Principal transaction</Col>
            <Col className="text-end mb-2">
              <TransactionList
                contract={contract}
                transactionType={TransactionType.PrincipalGiven}
              />
            </Col>
          </Row>
        </>
      );
    case ContractStatus.RepaymentProvided:
    case ContractStatus.RepaymentConfirmed:
      return (
        <>
          <Row className="justify-content-between border-b mt-2">
            <Col>Funding transaction</Col>
            <Col className="text-end mb-2">
              <TransactionList
                contract={contract}
                transactionType={TransactionType.Funding}
              />
            </Col>
          </Row>
          <Row className="justify-content-between border-b mt-2">
            <Col>Principal transaction</Col>
            <Col className="text-end mb-2">
              <TransactionList
                contract={contract}
                transactionType={TransactionType.PrincipalGiven}
              />
            </Col>
          </Row>
          <Row className="justify-content-between border-b mt-2">
            <Col>Principal repayment transaction</Col>
            <Col className="text-end mb-2">
              <TransactionList
                contract={contract}
                transactionType={TransactionType.PrincipalRepaid}
              />
            </Col>
          </Row>
        </>
      );
    case ContractStatus.Closing:
    case ContractStatus.Closed:
      return (
        <>
          <Row className="justify-content-between border-b mt-2">
            <Col>Funding transaction</Col>
            <Col className="text-end mb-2">
              <TransactionList
                contract={contract}
                transactionType={TransactionType.Funding}
              />
            </Col>
          </Row>
          <Row className="justify-content-between border-b mt-2">
            <Col>Principal transaction</Col>
            <Col className="text-end mb-2">
              <TransactionList
                contract={contract}
                transactionType={TransactionType.PrincipalGiven}
              />
            </Col>
          </Row>
          <Row className="justify-content-between border-b mt-2">
            <Col>Principal repayment transaction</Col>
            <Col className="text-end mb-2">
              <TransactionList
                contract={contract}
                transactionType={TransactionType.PrincipalRepaid}
              />
            </Col>
          </Row>
          <Row className="justify-content-between mt-2">
            <Col>Collateral claim transaction</Col>
            <Col className="text-end mb-2">
              <TransactionList
                contract={contract}
                transactionType={TransactionType.ClaimCollateral}
              />
            </Col>
          </Row>
        </>
      );
    case ContractStatus.Rejected:
    case ContractStatus.RequestExpired:
    case ContractStatus.DisputeBorrowerStarted:
    case ContractStatus.DisputeLenderStarted:
    case ContractStatus.DisputeBorrowerResolved:
    case ContractStatus.DisputeLenderResolved:
    default:
      // TODO
      return "";
  }
};

interface ContractStatusDetailsProps {
  contract: Contract;
  collateralBtc: number;
  totalCollateral: string;
  contractAddress: string;
  totalRepaymentAmount: number;
  loanOriginatorFee: number;
  loanOriginatorFeeUsd: string;
}

const ContractStatusDetails = ({
  contract,
  collateralBtc,
  totalCollateral,
  contractAddress,
  totalRepaymentAmount,
  loanOriginatorFee,
  loanOriginatorFeeUsd,
}: ContractStatusDetailsProps) => {
  switch (contract.status) {
    case ContractStatus.Requested:
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
    case ContractStatus.PrincipalGiven:
      return (
        <ContractPrincipalGiven
          repaymentAddress={contract.loan_repayment_address}
          totalRepaymentAmount={totalRepaymentAmount}
          contractId={contract.id}
        />
      );
    case ContractStatus.RepaymentProvided:
      return <ContractPrincipalRepaid />;
    case ContractStatus.RepaymentConfirmed:
      return <ContractRepaid contract={contract} collateralBtc={collateralBtc} />;
    case ContractStatus.Closed:
    case ContractStatus.Closing:
    case ContractStatus.Rejected:
    case ContractStatus.RequestExpired:
    default:
      return "";
  }
};
