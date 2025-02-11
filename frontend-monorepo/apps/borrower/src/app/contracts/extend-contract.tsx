import { faWarning } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  UnlockWalletModal,
  useWallet,
} from "@frontend-monorepo/browser-wallet";
import {
  Contract,
  LoanOffer,
  useBorrowerHttpClient,
} from "@frontend-monorepo/http-client-borrower";
import {
  formatCurrency,
  InterestRateInfoLabel,
  ONE_YEAR,
  StableCoin,
  StableCoinHelper,
  usePrice,
} from "@frontend-monorepo/ui-shared";
import {
  AlertDialog,
  Box,
  Button,
  Callout,
  Flex,
  Separator,
  Slider,
  Spinner,
  Text,
} from "@radix-ui/themes";
import { addDays } from "date-fns";
import { useMemo, useState } from "react";
import { FaInfoCircle } from "react-icons/fa";
import { GoAlertFill } from "react-icons/go";
import { useNavigate } from "react-router-dom";
import { useAsync } from "react-use";

interface ConfirmationDialogProps {
  isOpen: boolean;
  setIsOpen: (value: ((prevState: boolean) => boolean) | boolean) => void;
  onConfirm: () => void;
}

const ConfirmationDialog = ({
  isOpen,
  setIsOpen,
  onConfirm,
}: ConfirmationDialogProps) => {
  return (
    <AlertDialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialog.Content className="fixed left-1/2 top-1/2 max-h-[85vh] w-[90vw] max-w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-md bg-white p-[25px] shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] focus:outline-none data-[state=open]:animate-contentShow">
        <AlertDialog.Title className="m-0 text-[17px] font-medium text-mauve12">
          Contract request sent
        </AlertDialog.Title>
        <AlertDialog.Description className="mb-5 mt-[15px] text-[15px] leading-normal text-mauve11">
          Your renewal request has been sent to the lender.
        </AlertDialog.Description>
        <div className="flex justify-end gap-[25px]">
          <AlertDialog.Action>
            <Button
              className="inline-flex h-[35px] items-center justify-center rounded bg-red4 px-[15px] font-medium leading-none text-red11 outline-none hover:bg-red5 focus:shadow-[0_0_0_2px] focus:shadow-red7"
              onClick={() => onConfirm()}
            >
              Continue
            </Button>
          </AlertDialog.Action>
        </div>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
};

interface SelectedLoanOfferProps {
  contractId: string;
  newDurationDays: number;
  amount: number;
  totalDuration: number;
  totalInterestRate: number;
  additionalOriginationFee: number;
  offerId: string;
  newExpiry: Date;
  resetSelectedAction: () => void;
}

const SelectedLoanOffer = (props: SelectedLoanOfferProps) => {
  const navigate = useNavigate();
  const { isWalletLoaded } = useWallet();
  const { latestPrice } = usePrice();
  const [error, setError] = useState("");
  const { postExtendLoanRequest } = useBorrowerHttpClient();

  const [walletSecretConfirmed, setWalletSecretConfirmed] =
    useState(isWalletLoaded);
  const [showUnlockWalletModal, setShowUnlockWalletModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [newContractId, setNewContractId] = useState("");
  const [isFinalConfirmationDialogOpen, setIsFinalConfirmationDialogOpen] =
    useState(false);

  const handleCloseUnlockWalletModal = () => setShowUnlockWalletModal(false);
  const handleOpenUnlockWalletModal = () => setShowUnlockWalletModal(true);

  const handleSubmitUnlockWalletModal = async () => {
    setWalletSecretConfirmed(true);
    handleCloseUnlockWalletModal();
  };

  const UnlockWallet = async () => {
    try {
      if (!isWalletLoaded) {
        handleOpenUnlockWalletModal();
        return;
      }
    } catch (error) {
      console.log(`Unexpected error happened: ${error}`);
      setError(`Failed unlocking wallet: ${error}`);
    }
  };

  const actualInterest =
    props.totalInterestRate / (ONE_YEAR / props.totalDuration);
  const actualInterestUsdAmount = props.amount * actualInterest;
  const extensionFeeBtc =
    (props.additionalOriginationFee * props.amount) / latestPrice;
  const extensionFeeUsd = props.additionalOriginationFee * props.amount;

  const confirmOfferButtonEnabled = walletSecretConfirmed;

  const onExtendLoanContract = async () => {
    try {
      setError("");
      setIsLoading(true);
      const newContract = await postExtendLoanRequest(props.contractId, {
        loan_id: props.offerId,
        new_duration: props.newDurationDays,
      });
      setNewContractId(newContract?.id || "");
      setIsFinalConfirmationDialogOpen(true);
    } catch (error) {
      console.log(`Failed sending request ${error}`);
      setError(`Failed sending request ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const onFinalConfirmationDialogClose = () => {
    setIsFinalConfirmationDialogOpen(false);
    props.resetSelectedAction();
    navigate(`/my-contracts/${newContractId}`);
  };

  return (
    <>
      <ConfirmationDialog
        isOpen={isFinalConfirmationDialogOpen}
        setIsOpen={setIsFinalConfirmationDialogOpen}
        onConfirm={onFinalConfirmationDialogClose}
      />
      <UnlockWalletModal
        show={showUnlockWalletModal}
        handleClose={handleCloseUnlockWalletModal}
        handleSubmit={handleSubmitUnlockWalletModal}
      />
      <Box>
        <Box className="px-6 py-4 space-y-3">
          <Separator size={"4"} />
          <Flex justify={"between"} align={"center"}>
            <InterestRateInfoLabel>
              <Flex
                align={"center"}
                gap={"2"}
                className="text-font dark:text-font-dark"
              >
                <Text className="text-xs font-medium text-font/60 dark:text-font-dark/60">
                  Total Interest
                </Text>
                <FaInfoCircle />
              </Flex>
            </InterestRateInfoLabel>

            <div className="flex flex-col">
              <Text className="text-[13px] font-semibold text-font/70 dark:text-font-dark/70 capitalize">
                {(props.totalInterestRate * 100).toFixed(1)}% per year
              </Text>
              <Text className="text-[11px] text-font/50 dark:text-font-dark/50 mt-0.5 self-end">
                ≈ {formatCurrency(actualInterestUsdAmount, 1, 1)} in total
              </Text>
            </div>
          </Flex>
          <Flex justify={"between"} align={"center"}>
            <Text className="text-xs font-medium text-font/60 dark:text-font-dark/60">
              New expiry
            </Text>
            <Text className="text-[13px] font-semibold text-font/70 dark:text-font-dark/70 capitalize">
              {props.newExpiry.toLocaleDateString()}
            </Text>
          </Flex>
          <Separator size={"4"} />
          <Flex justify={"between"} align={"center"}>
            <Text className="text-xs font-medium text-font/60 dark:text-font-dark/60">
              Extension Fee
            </Text>
            <Text className="text-[13px] font-semibold text-font/70 dark:text-font-dark/70 capitalize"></Text>
            <div className="flex flex-col">
              <Text className="text-[13px] font-semibold text-font/70 dark:text-font-dark/70 capitalize">
                {extensionFeeBtc.toFixed(8)} BTC
              </Text>
              <Text className="text-[11px] text-font/50 dark:text-font-dark/50 mt-0.5 self-end">
                ≈ {formatCurrency(extensionFeeUsd, 1, 1)} in total
              </Text>
            </div>
          </Flex>

          <Box className="flex space-x-4 justify-center">
            <Button
              size={"3"}
              variant="solid"
              className={`text-white ${
                !walletSecretConfirmed ? "bg-purple-950" : "bg-gray-400"
              }`}
              onClick={() => UnlockWallet()}
              disabled={walletSecretConfirmed}
              loading={isLoading}
            >
              <Text size={"2"} className="font-semibold">
                Confirm Secret
              </Text>
            </Button>
            <Button
              size={"3"}
              variant="solid"
              className={`text-white ${
                confirmOfferButtonEnabled ? "bg-purple-950" : "bg-gray-400"
              }`}
              onClick={() => {
                onExtendLoanContract();
              }}
              disabled={!confirmOfferButtonEnabled}
              // TODO:
              loading={isLoading}
            >
              <Text size={"2"} className="font-semibold">
                Confirm Offer
              </Text>
            </Button>
          </Box>

          {error ? (
            <Box px={"2"} className="md:col-span-2">
              <Callout.Root color="red" className="w-full">
                <Callout.Icon>
                  <FontAwesomeIcon icon={faWarning} />
                </Callout.Icon>
                <Callout.Text>{error}</Callout.Text>
              </Callout.Root>
            </Box>
          ) : (
            ""
          )}
        </Box>
      </Box>
    </>
  );
};

const findBestOffer = (offers: LoanOffer[], days: number) => {
  return offers
    .filter(
      (offer) =>
        offer.duration_days_min <= days && offer.duration_days_max >= days,
    )
    .reduce((best, current) =>
      current.interest_rate < best.interest_rate ? current : best,
    );
};

interface ExtendContractProps {
  contract: Contract;
  coin: StableCoin;
  resetSelectedAction: () => void;
}

export const ExtendContract = ({
  contract,
  coin,
  resetSelectedAction,
}: ExtendContractProps) => {
  const [sliderDuration, setSliderDuration] = useState<number | undefined>();
  const { getLoanOffersByLender } = useBorrowerHttpClient();

  const lenderIdMemorized = useMemo(() => {
    return contract.lender.id;
  }, [contract]);

  const {
    error: loadingError,
    value,
    loading,
  } = useAsync(async () => {
    return getLoanOffersByLender(lenderIdMemorized);
  }, [lenderIdMemorized]);

  if (loading) {
    // TODO: this can be made nicer
    return <Spinner />;
  }

  if (loadingError) {
    return (
      <Callout.Root>
        <Callout.Icon>
          <GoAlertFill />
        </Callout.Icon>
        <Callout.Text>{loadingError.message}</Callout.Text>
      </Callout.Root>
    );
  }

  const unfilteredOffers = value || [];
  const offers = unfilteredOffers
    .filter(
      (offer) =>
        StableCoinHelper.mapFromBackend(
          offer.loan_asset_chain,
          offer.loan_asset_type,
        ) === coin,
    )
    .filter((offer) => {
      return (
        offer.loan_amount_min <= contract.loan_amount &&
        offer.loan_amount_max >= contract.loan_amount
      );
    });

  if (offers.length === 0) {
    return (
      <Callout.Root color={"orange"}>
        <Callout.Icon>
          <GoAlertFill />
        </Callout.Icon>
        <Callout.Text>
          {/*TODO: in the future we could send a request for extension nevertheless*/}
          {
            "The lender does not have any open offers or disabled extending contracts."
          }
        </Callout.Text>
      </Callout.Root>
    );
  }

  const maxAvailableDays = Math.max(
    ...offers.map((offer) => offer.duration_days_max),
  );
  const minAvailableDays = Math.min(
    ...offers.map((offer) => offer.duration_days_min),
  );

  const onValueChange = (days: number) => {
    setSliderDuration(days);
  };

  const selectedDurationDays = sliderDuration || maxAvailableDays;
  const bestOffer = findBestOffer(offers, selectedDurationDays);

  const totalInterestRate =
    (bestOffer.interest_rate * selectedDurationDays +
      contract.interest_rate * contract.duration_days) /
    (selectedDurationDays + contract.duration_days);

  const totalDuration = selectedDurationDays + contract.duration_days;
  const creationDate = contract.expiry;
  const newExpiry = addDays(creationDate, selectedDurationDays);

  return (
    <Box className="flex flex-col items-center justify-center p-6 md:p-8">
      <Box className="flex flex-col items-center h-full w-full border border-font/10 bg-white max-w-lg rounded-3xl pt-10 dark:border-dark dark:bg-dark-700 dark:text-white">
        <Text size="4" mb="4" className="text-font dark:text-font-dark">
          Please select the desired duration
        </Text>

        <div className="flex flex-col items-center gap-3 m-2 w-full px-4">
          <div className="w-full">
            <Slider
              className="w-full"
              onValueChange={([newVal]) => onValueChange(newVal)}
              defaultValue={[maxAvailableDays]}
              max={maxAvailableDays}
              min={minAvailableDays}
              step={1}
            />
          </div>
          <Text className="min-w-[90px] text-sm">
            {selectedDurationDays} {selectedDurationDays === 1 ? "day" : "days"}
          </Text>
        </div>

        <Box className="w-full">
          <SelectedLoanOffer
            contractId={contract.id}
            offerId={bestOffer.id}
            amount={contract.loan_amount}
            newDurationDays={selectedDurationDays}
            totalDuration={totalDuration}
            totalInterestRate={totalInterestRate}
            additionalOriginationFee={bestOffer.origination_fee[0].fee || 0}
            newExpiry={newExpiry}
            resetSelectedAction={resetSelectedAction}
          />
        </Box>
      </Box>
    </Box>
  );
};
