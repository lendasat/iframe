import { faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { UnlockWalletModal, useWallet } from "@frontend-monorepo/browser-wallet";
import type { Contract } from "@frontend-monorepo/http-client-borrower";
import { useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import { FeeSelector } from "@frontend-monorepo/mempool";
import { Callout, Heading } from "@radix-ui/themes";
import { useState } from "react";
import { Alert, Button, Col, Container, Row } from "react-bootstrap";
import { IoInformationCircleOutline } from "react-icons/io5";
import { useNavigate } from "react-router-dom";

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
  const [showUnlockWalletModal, setShowUnlockWalletModal] = useState(false);

  const [error, setError] = useState("");

  const handleCloseUnlockWalletModal = () => setShowUnlockWalletModal(false);
  const handleOpenUnlockWalletModal = () => setShowUnlockWalletModal(true);

  const { isWalletLoaded, signClaimPsbt } = useWallet();

  const claimCollateral = async () => {
    try {
      if (!isWalletLoaded) {
        handleOpenUnlockWalletModal();
        return;
      } else {
        await claimCollateralRequest();
      }
    } catch (err) {
      console.error("Failed to claim collateral", err);
      throw err;
    }
  };

  const unlockWallet = async () => {
    try {
      if (!isWalletLoaded) {
        handleOpenUnlockWalletModal();
        return;
      }
    } catch (err) {
      console.error("Failed unlocking wallet", err);
      throw err;
    }
  };

  const claimCollateralRequest = async () => {
    const res = await getClaimCollateralPsbt(contract.id, selectedFee);
    const claimTx = await signClaimPsbt(res.psbt, res.collateral_descriptor);

    const txid = await postClaimTx(contract.id, claimTx);

    alert(`Transaction ${txid} was published!`);

    navigate("/my-contracts");
  };

  const handleSubmitUnlockWalletModal = async () => {
    handleCloseUnlockWalletModal();
  };

  const onUnlockOrWithdraw = async () => {
    if (isWalletLoaded) {
      try {
        await claimCollateral();
      } catch (e) {
        const err = e as Error;
        setError(`Failed to claim collateral: ${err.message}`);
      }
    } else {
      try {
        await unlockWallet();
      } catch (e) {
        const err = e as Error;
        setError(`Failed to unlock contract: ${err.message}`);
      }
    }
  };

  return (
    <>
      <UnlockWalletModal
        show={showUnlockWalletModal}
        handleClose={handleCloseUnlockWalletModal}
        handleSubmit={handleSubmitUnlockWalletModal}
      />
      <Container fluid>
        <Heading size={"4"} weight={"medium"}>
          Claim collateral
        </Heading>
        <Row className="mt-4">
          <Col className="text-center">
            <div className="d-flex justify-content-center align-items-center flex-column">
              <p className="mt-2 text-break">
                To claim the collateral you will have to provide your <strong>contract secret</strong>.
              </p>
            </div>
          </Col>
        </Row>
        <Row className="mt-2">
          <Col>
            <Alert className="text-center" variant="info">
              <FontAwesomeIcon icon={faInfoCircle} /> The <strong>{collateralBtc} BTC</strong>{"  "}
              collateral will be sent to this address: <strong>{refundAddress}</strong>.
            </Alert>
          </Col>
        </Row>
        <FeeSelector onSelectFee={setSelectedFee}></FeeSelector>

        <Row className="justify-content-between mt-4">
          <Row className="mt-1">
            <Col className="d-grid">
              <Button
                variant="primary"
                onClick={onUnlockOrWithdraw}
              >
                {isWalletLoaded ? "Withdraw Funds" : "Unlock Contract"}
              </Button>
              {error && (
                <Col className="d-grid mt-4">
                  <Callout.Root color="tomato">
                    <Callout.Icon>
                      <IoInformationCircleOutline />
                    </Callout.Icon>
                    <Callout.Text>
                      {error}
                    </Callout.Text>
                  </Callout.Root>
                </Col>
              )}
            </Col>
          </Row>
        </Row>
      </Container>
    </>
  );
}
