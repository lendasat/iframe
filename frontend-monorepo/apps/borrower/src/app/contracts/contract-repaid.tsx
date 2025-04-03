import { faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { UnlockWalletModal, useWallet } from "@frontend/browser-wallet";
import type { Contract } from "@frontend/http-client-borrower";
import { useBorrowerHttpClient } from "@frontend/http-client-borrower";
import { FeeSelector } from "@frontend/mempool";
import { Callout, Heading } from "@radix-ui/themes";
import { useState } from "react";
import { IoInformationCircleOutline } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import { Button } from "@frontend/shadcn";

interface ContractRepaidProps {
  contract: Contract;
  collateralBtc: number;
}

export function ContractRepaid({
  contract,
  collateralBtc,
}: ContractRepaidProps) {
  const refundAddress = contract.borrower_btc_address;

  const { getClaimCollateralPsbt, postClaimTx } = useBorrowerHttpClient();
  const navigate = useNavigate();

  const [selectedFee, setSelectedFee] = useState(1);

  const [error, setError] = useState("");

  const { isWalletLoaded, signClaimPsbt } = useWallet();

  const claimCollateral = async () => {
    try {
      await claimCollateralRequest();
    } catch (err) {
      console.error("Failed to claim collateral", err);
      throw err;
    }
  };

  const claimCollateralRequest = async () => {
    console.log("Getting claim collateral PSBT");

    const res = await getClaimCollateralPsbt(contract.id, selectedFee);

    console.log("Signing claim collateral PSBT");

    const claimTx = await signClaimPsbt(
      res.psbt,
      res.collateral_descriptor,
      res.borrower_pk,
      contract.borrower_derivation_path,
    );

    console.log("Posting signed claim TX");

    const txid = await postClaimTx(contract.id, claimTx.tx);

    alert(`Collateral claim transaction ${txid} was published!`);

    navigate("/my-contracts");
  };

  const onUnlockOrWithdraw = async () => {
    if (isWalletLoaded) {
      try {
        await claimCollateral();
      } catch (e) {
        const err = e as Error;
        setError(`Failed to claim collateral: ${err.message}`);
      }
    }
  };

  return (
    <div className="px-4">
      <Heading
        className="text-font dark:text-font-dark"
        size="4"
        weight="medium"
      >
        Claim Collateral
      </Heading>
      <div className="mt-4">
        <p className="text-break text-font dark:text-font-dark mt-2">
          To claim the collateral you will have to provide your{" "}
          <strong>password</strong>.
        </p>
      </div>
      <div className="mt-2">
        <div className="rounded bg-blue-100 p-4 text-blue-800">
          <FontAwesomeIcon icon={faInfoCircle} /> The{" "}
          <strong>{collateralBtc} BTC</strong> collateral will be sent to your
          collateral refund address: <strong>{refundAddress}</strong>.
        </div>
      </div>
      <div className="mt-4">
        <FeeSelector onSelectFee={setSelectedFee} />
      </div>

      <div className="mt-4 max-w-md mx-auto">
        {!isWalletLoaded && (
          <UnlockWalletModal handleSubmit={() => {}}>
            <Button type={"button"} className={"w-full"}>
              Unlock Contract
            </Button>
          </UnlockWalletModal>
        )}
        {isWalletLoaded && (
          <Button className="w-full" onClick={onUnlockOrWithdraw}>
            {"Withdraw Funds"}
          </Button>
        )}

        {error && (
          <div className="mt-4">
            <Callout.Root color="tomato">
              <Callout.Icon>
                <IoInformationCircleOutline />
              </Callout.Icon>
              <Callout.Text>{error}</Callout.Text>
            </Callout.Root>
          </div>
        )}
      </div>
    </div>
  );
}
