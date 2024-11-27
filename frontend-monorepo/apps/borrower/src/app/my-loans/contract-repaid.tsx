import { faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { UnlockWalletModal, useWallet } from "@frontend-monorepo/browser-wallet";
import type { Contract } from "@frontend-monorepo/http-client-borrower";
import { useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import { FeeSelector } from "@frontend-monorepo/mempool";
import { useState } from "react";
import { Alert, Button, Col, Container, Row } from "react-bootstrap";
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

  return (
    <>
      <UnlockWalletModal
        show={showUnlockWalletModal}
        handleClose={handleCloseUnlockWalletModal}
        handleSubmit={handleSubmitUnlockWalletModal}
      />
      <Container fluid>
        <Row>
          <h4>Claim collateral</h4>
        </Row>

        <Row className="mt-4">
          <Col className="text-center">
            <div className="d-flex justify-content-center align-items-center flex-column">
              <p className="mt-2 text-break">
                To claim your collateral please confirm with your <strong>contract secret</strong>.
              </p>
            </div>
          </Col>
        </Row>
        <Row className="mt-2">
          <Col>
            <Alert variant="info">
              <FontAwesomeIcon icon={faInfoCircle} /> Once claimed, your collateral of{" "}
              <strong>{collateralBtc} BTC</strong> will be disbursed to <strong>{refundAddress}</strong>.
            </Alert>
          </Col>
        </Row>
        <FeeSelector onSelectFee={setSelectedFee}></FeeSelector>

        <Row className="justify-content-between mt-4">
          <Row className="mt-1">
            <Col className="d-grid">
              <Button
                variant="primary"
                onClick={async () => {
                  if (isWalletLoaded) {
                    await claimCollateral();
                  } else {
                    await unlockWallet();
                  }
                }}
              >
                {isWalletLoaded ? "Withdraw funds" : "Unlock Contract"}
              </Button>
            </Col>
          </Row>
        </Row>
      </Container>
    </>
  );
}
