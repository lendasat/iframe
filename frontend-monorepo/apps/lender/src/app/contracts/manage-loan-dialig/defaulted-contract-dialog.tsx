import React, { ReactNode, useState } from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
} from "@frontend/shadcn";
import { AlertTriangle } from "lucide-react";
import {
  Contract,
  ContractStatus,
  GetLiquidationPsbtResponse,
  useLenderHttpClient,
} from "@frontend/http-client-lender";
import {
  formatBitcoin,
  getTxUrl,
  LoanAssetHelper,
  usePrice,
} from "@frontend/ui-shared";
import { BitcoinTransactionFeeSelector } from "./liquidate/bitcoin-transaction-fee-selector";
import { Network, validate } from "bitcoin-address-validation";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useFees } from "@frontend/mempool";
import { useWallet } from "@frontend/browser-wallet";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface DefaultedLoanDialogProps {
  contract: Contract;
  children: ReactNode;
}

const addressSchema = z.object({
  payAsBitcoin: z.boolean(),
  password: z.string().min(1, "Password is required"),
  address: z
    .string()
    .min(1, "Address is required")
    .refine(
      (value) => {
        let network = Network.mainnet;
        if (import.meta.env.VITE_BITCOIN_NETWORK === "signet") {
          network = Network.testnet;
        } else if (import.meta.env.VITE_BITCOIN_NETWORK === "regtest") {
          network = Network.regtest;
        }
        return validate(value, network);
      },
      {
        message: "Invalid address format",
      },
    ),
});

const DefaultedOrUndercollateralizedContractDialog = ({
  contract,
  children,
}: DefaultedLoanDialogProps) => {
  const navigate = useNavigate();
  const { recommendedFees } = useFees();
  const { signLiquidationPsbtWithPassword } = useWallet();
  const {
    getLiquidationToStablecoinPsbt,
    getLiquidationToBitcoinPsbt,
    postLiquidationTx,
  } = useLenderHttpClient();
  const { latestPrice } = usePrice();

  const [payAsBitcoin, setPayAsBitcoin] = useState("true");
  const [selectedFeerate, setSelectedFeerate] = useState(1);
  const [success, setSuccess] = useState(false);
  const [txid, setTxid] = useState("");

  const loanAmount = contract.loan_amount;
  const collateralAsset = contract.loan_asset;
  const loanAmountBitcoin = loanAmount / latestPrice || 0.0;

  const form = useForm<z.infer<typeof addressSchema>>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      payAsBitcoin: true,
      password: "",
      address: "",
    },
  });

  // 2. Define a submit handler.
  async function onSubmit(values: z.infer<typeof addressSchema>) {
    try {
      const liquidateToBitcoin = payAsBitcoin === "true";

      console.log(
        `Liquidating to ${liquidateToBitcoin ? "Bitcoin" : "Stablecoins"} `,
      );

      let liquidationResponse: GetLiquidationPsbtResponse;

      if (!liquidateToBitcoin) {
        liquidationResponse = await getLiquidationToStablecoinPsbt(
          contract.id,
          // this is on purpose: we overwrite whatever the user selected, because we need the tx to get into the next block
          recommendedFees?.fastestFee || 10,
          values.address,
        );
      } else {
        liquidationResponse = await getLiquidationToBitcoinPsbt(
          contract.id,
          // this is on purpose: we overwrite whatever the user selected, because we need the tx to get into the next block
          recommendedFees?.fastestFee || 10,
          values.address,
        );
      }

      console.log(
        `Signing liquidation PSBT: ${JSON.stringify(liquidationResponse)}`,
      );

      const tx = await signLiquidationPsbtWithPassword(
        values.password,
        liquidationResponse.psbt,
        liquidationResponse.collateral_descriptor,
        liquidationResponse.lender_pk,
        contract.lender_derivation_path,
      );

      console.log(`Signed liquidation PSBT '${tx.tx}'`);

      const txid = await postLiquidationTx(contract.id, tx.tx);

      setSuccess(true);
      setTxid(txid);
      toast.success("Success", {
        description: "Transaction has been published successfully.",
        action: {
          label: "View on mempool.space",
          onClick: () => {
            const url = getTxUrl(txid); // Assuming this function returns the URL
            window.open(url, "_blank");
          },
        },
      });
    } catch (error) {
      console.error(`Failed publishing liquidation transaction ${error}`);
      toast.error("Error", {
        description: `Failed to post liquidation TX: ${error}`,
        duration: 30000,
      });
    }
  }

  let description = "The borrower has defaulted on their loan. ";
  if (contract.status === ContractStatus.Undercollateralized) {
    description = "The contract is under collateralized. ";
  }

  return (
    <Dialog>
      <DialogTrigger>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Liquidate Contract</DialogTitle>
          <DialogDescription>
            {description} {"You can now liquidate it."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="py-4">
              <div className="space-y-4">
                <Alert variant={"default"}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Heads up!</AlertTitle>
                  <AlertDescription>
                    You will receive ${loanAmount} in{" "}
                    {LoanAssetHelper.print(collateralAsset)} or the equivalent
                    in Bitcoin if you prefer. At the current rate this is
                    approximately ~{formatBitcoin(loanAmountBitcoin)} BTC
                  </AlertDescription>
                </Alert>
              </div>
            </div>

            <FormField
              control={form.control}
              name="payAsBitcoin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={""}>
                    How do you want to get paid?
                  </FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={(val) => {
                        setPayAsBitcoin(val);
                        field.onChange(val === "true");
                      }}
                      defaultValue={field.value.toString()}
                      className="flex flex-row space-y-1"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="true" id="payment-bitcoin" />
                        <Label htmlFor="payment-bitcoin">Bitcoin</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="false" id="payment-other" />
                        <Label htmlFor="payment-other">Stablecoins</Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={""}>
                    {form.getValues().payAsBitcoin
                      ? "Bitcoin Address"
                      : "Fallback Bitcoin Address"}
                  </FormLabel>
                  <FormControl>
                    <Input {...field} type={"text"} autoComplete="off" />
                  </FormControl>
                  <FormDescription>
                    {form.getValues().payAsBitcoin
                      ? "Where you want to receive your bitcoin"
                      : "In case of an error, you will receive bitcoin to this address."}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <BitcoinTransactionFeeSelector
              onSelectFee={setSelectedFeerate}
              selectedFee={selectedFeerate}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={""}>Account Password</FormLabel>
                  <FormControl>
                    <Input {...field} type={"password"} />
                  </FormControl>
                  <FormDescription>
                    Please confirm your account password
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {txid && (
              <Alert variant={"default"}>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Success</AlertTitle>
                <AlertDescription>
                  Transaction has been published successfully.{" "}
                  <a
                    href={getTxUrl(txid)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-medium"
                  >
                    View on mempool.space
                  </a>
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter className="flex sm:justify-between flex-col sm:flex-row gap-2">
              <DialogClose>
                <Button variant="outline">Cancel</Button>
              </DialogClose>

              {success && (
                <DialogClose>
                  <Button variant="default" onClick={() => navigate(0)}>
                    Done
                  </Button>
                </DialogClose>
              )}

              {!success && <Button type="submit">Submit</Button>}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default DefaultedOrUndercollateralizedContractDialog;
