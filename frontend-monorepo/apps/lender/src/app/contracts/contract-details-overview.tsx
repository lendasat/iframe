import { faExclamationCircle, faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  Contract,
  ContractStatus,
  contractStatusToLabelString,
  LiquidationStatus,
  useLenderHttpClient,
} from "@frontend-monorepo/http-client-lender";
import { CurrencyFormatter, StableCoinHelper } from "@frontend-monorepo/ui-shared";
import { Badge, Box, Button, Callout, Dialog, Flex, Grid, Heading, Separator, Text } from "@radix-ui/themes";
import React, { Suspense, useState } from "react";
import { Alert, OverlayTrigger, Spinner, Tooltip } from "react-bootstrap";
import { Await, useNavigate, useParams } from "react-router-dom";
import { ExpandableDisputeCard } from "../disputes/dispute-card";
import RepaymentDetails from "./pay-loan-principal";

function ContractDetailsOverview() {
  const { innerHeight } = window;
  const { getContract } = useLenderHttpClient();
  const { id } = useParams();

  return (
    <Suspense>
      <Await
        resolve={getContract(id!)}
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

  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [startingDisputeLoading, setStartingDisputeLoading] = useState(false);

  const collateral_sats = contract.initial_collateral_sats;
  const collateral = collateral_sats / 100000000;
  const loanAmount = contract.loan_amount;
  const durationMonths = contract.duration_months;

  const interestRate = contract.interest_rate;

  const initialLtv = contract.initial_ltv;
  const initial_price = loanAmount / (collateral * initialLtv);

  const initialLtvFormatted = (initialLtv * 100).toFixed(0);

  const disputeInProgress = contract.status === ContractStatus.DisputeBorrowerResolved
    || contract.status === ContractStatus.DisputeLenderResolved
    || contract.status === ContractStatus.DisputeBorrowerStarted
    || contract.status === ContractStatus.DisputeLenderStarted;

  const loanOriginatorFee = contract.origination_fee_sats / 100000000;
  const loanOriginatorFeeUsd = (loanOriginatorFee * initial_price).toFixed(0);

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

  const [errorAlt, setErrorAlt] = useState("");
  const navigate = useNavigate();

  const onSuccess = () => {
    navigate(0);
  };

  const displayDispute = contract.status !== ContractStatus.Requested && contract.status !== ContractStatus.Approved;

  const stableCoin = StableCoinHelper.mapFromBackend(contract.loan_asset_chain, contract.loan_asset_type);

  return (
    <Grid className="md:grid-cols-2">
      <Box className="border-r border-font/10">
        <Box className="p-6 md:pl-8 border-b border-font/10">
          <Heading size={"6"}>
            Contract Details
          </Heading>
        </Box>
        <Box className="p-6 md:p-8 space-y-5">
          <Flex gap={"5"} align={"start"} justify={"between"}>
            <Text size={"2"} weight={"medium"} className="text-font/70 shrink-0">
              Tracking ID
            </Text>
            <Text size={"2"} weight={"medium"} className="text-end">
              {contract.id}
            </Text>
          </Flex>
          <Separator size={"4"} className="bg-font/10" />

          <Flex gap={"5"} align={"start"} justify={"between"}>
            <Text size={"2"} weight={"medium"} className="shrink-0 text-font/70">
              Borrower ID
            </Text>
            <Box className="max-w-sm text-end">
              <div className="flex flex-col">
                <Text size={"2"} weight={"medium"} className="break-all">
                  {contract.borrower.name}
                </Text>
                <Text size={"1"} className="break-all">
                  ({contract.borrower.id})
                </Text>
              </div>
            </Box>
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
              Asset / Chain
            </Text>
            <Text size={"2"} weight={"medium"}>
              <Text>
                {stableCoin
                  ? <Badge>{StableCoinHelper.print(stableCoin)}</Badge>
                  : (
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
            <Text size={"2"} weight={"medium"} className="text-font/70">
              Origination fee (1%)
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
            <Text size={"2"} weight={"medium"} className="text-font/70">
              LTV ratio
            </Text>
            <Text size={"2"} weight={"medium"}>
              {initialLtvFormatted}%
            </Text>
          </Flex>
          <Separator size={"4"} className="bg-font/10" />

          <Flex gap={"5"} align={"start"} justify={"between"}>
            <Text size={"2"} weight={"medium"} className="text-font/70">
              Interest rate p.a.
            </Text>
            <Text size={"2"} weight={"medium"}>
              {interestRate * 100}%
            </Text>
          </Flex>
          <Separator size={"4"} className="bg-font/10" />
          <AdditionalDetail contract={contract} />
          {errorAlt && (
            <Callout.Root color="red">
              <Callout.Icon>
                <FontAwesomeIcon icon={faExclamationCircle} className="h-4 w-4" />
              </Callout.Icon>
              <Callout.Text>
                {error}
              </Callout.Text>
            </Callout.Root>
          )}

          <Flex justify={"end"}>
            <ContractStatusDetails
              contract={contract}
              onError={setErrorAlt}
              onSuccess={onSuccess}
            />
          </Flex>
        </Box>
      </Box>
      {displayDispute
        && (
          <Box className="p-6 md:p-8 space-y-5">
            <ExpandableDisputeCard
              info={info}
              onStartDispute={onStartDispute}
              startingDisputeLoading={startingDisputeLoading}
              error={error}
              disputeInProgress={disputeInProgress}
            />
          </Box>
        )}
    </Grid>
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
        <Box className="space-y-5">
          <Flex gap={"5"} align={"start"} justify={"between"}>
            <Text size={"2"} weight={"medium"} className="text-font/70">
              Funding transaction
            </Text>
            <Text size={"2"} weight={"medium"}>
              TODO!
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
                TODO!
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
                TODO!
              </Text>
            </Flex>
            <Separator size={"4"} className="bg-font/10" />
          </Box>
        </>
      );
    case ContractStatus.Repaid:
      return (
        <>
          <Box className="space-y-5">
            <Flex gap={"5"} align={"start"} justify={"between"}>
              <Text size={"2"} weight={"medium"} className="text-font/70">
                Funding transaction
              </Text>
              <Text size={"2"} weight={"medium"}>
                TODO!
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
                TODO!
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
                TODO!
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
                TODO!
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
                TODO!
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
                TODO!
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
                TODO!
              </Text>
            </Flex>
            <Separator size={"4"} className="bg-font/10" />
          </Box>
        </>
      );
    case ContractStatus.Rejected:
      // TODO
      return "";
  }
};

interface ContractStatusDetailsProps {
  contract: Contract;
  onError: (error: string) => void;
  onSuccess: () => void;
}

const ContractStatusDetails = (
  {
    contract,
    onError,
    onSuccess,
  }: ContractStatusDetailsProps,
) => {
  const { approveContract, rejectContract, principalGiven, markAsRepaid } = useLenderHttpClient();
  const [isLoading, setIsLoading] = useState(false);
  const [txid, setTxid] = useState("");

  const onContractApprove = async () => {
    try {
      setIsLoading(true);
      await approveContract(contract.id);
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
      await markAsRepaid(contract.id, txid);
      onSuccess();
    } catch (error) {
      onError(`${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  switch (contract.status) {
    case ContractStatus.Requested:
      // TODO:
      return (
        <div className="d-flex gap-2">
          {/* Approve Button */}
          <Dialog.Root>
            <Dialog.Trigger>
              <Button color="green" loading={isLoading} disabled={isLoading} size={"3"}>
                Approve
              </Button>
            </Dialog.Trigger>
            <Dialog.Content maxWidth="450px">
              <Dialog.Title>Approval Contract</Dialog.Title>
              <Dialog.Description size="2" mb="4">
                Are you sure you want to approve this loan?
              </Dialog.Description>
              <Flex gap="3" mt="4" justify="end">
                <Dialog.Close>
                  <Button variant="soft" color="gray">
                    Quit
                  </Button>
                </Dialog.Close>
                <Button color="green" loading={isLoading} disabled={isLoading} onClick={onContractApprove}>
                  Approve
                </Button>
              </Flex>
            </Dialog.Content>
          </Dialog.Root>

          {/* Reject Button */}
          <Dialog.Root>
            <Dialog.Trigger>
              <Button color="red" loading={isLoading} disabled={isLoading} size={"3"}>
                Reject
              </Button>
            </Dialog.Trigger>
            <Dialog.Content maxWidth="450px">
              <Dialog.Title>Reject Contract</Dialog.Title>
              <Dialog.Description size="2" mb="4">
                Are you sure you want to reject this loan?
              </Dialog.Description>
              <Flex gap="3" mt="4" justify="end">
                <Dialog.Close>
                  <Button variant="soft" color="gray">
                    Quit
                  </Button>
                </Dialog.Close>
                <Button color="red" loading={isLoading} disabled={isLoading} onClick={onContractReject}>
                  Reject
                </Button>
              </Flex>
            </Dialog.Content>
          </Dialog.Root>
        </div>
      );
    case ContractStatus.Approved:
      return (
        <Callout.Root className="w-full" color="teal">
          <Callout.Icon>
            <FontAwesomeIcon icon={faInfoCircle} className="h-4 w-4" />
          </Callout.Icon>
          <Callout.Text>
            Waiting for user to fund the contract. Please refresh to check for updates.
          </Callout.Text>
        </Callout.Root>
      );
    case ContractStatus.CollateralSeen:
    case ContractStatus.CollateralConfirmed:
      return (
        <div>
          <label htmlFor="txid">Transaction ID:</label>
          <input
            id="txid"
            type="text"
            value={txid}
            onChange={(e) => setTxid(e.target.value)}
            placeholder="Enter transaction ID"
          />

          <RepaymentDetails contract={contract} isLoading={isLoading} onPrincipalGiven={onPrincipalGiven} />
        </div>
      );
    case ContractStatus.PrincipalGiven:
      return (
        <div>
          {/* Text input for txid */}
          <label htmlFor="txid">Transaction ID:</label>
          <input
            id="txid"
            type="text"
            value={txid}
            onChange={(e) => setTxid(e.target.value)}
            placeholder="Enter transaction ID"
          />

          <Button onClick={onMarkAsRepaid} disabled={isLoading}>
            {isLoading
              ? (
                <Spinner animation="border" role="status" variant="light" size="sm">
                  <span className="visually-hidden">Loading...</span>
                </Spinner>
              )
              : "Mark as repaid"}
          </Button>
        </div>
      );
    case ContractStatus.Repaid:
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
