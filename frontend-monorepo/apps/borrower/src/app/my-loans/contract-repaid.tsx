import { faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Contract, useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import React, { useState } from "react";
import { Alert, Button, Col, Container, Row } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import init, { is_wallet_loaded, sign_claim_psbt } from "../../../../../../borrower-wallet/pkg/borrower_wallet.js";
import { UnlockWalletModal } from "../wallet/unlock-wallet-modal";

interface ContractRepaidProps {
  contract: Contract;
}

export function ContractRepaid({
  contract,
}: ContractRepaidProps) {
  const collateralAmountBtc = contract.collateral_sats / 100000000;
  const refundAddress = contract.borrower_btc_address;

  const { getClaimCollateralPsbt, postClaimTx } = useBorrowerHttpClient();
  const navigate = useNavigate();

  const [showUnlockWalletModal, setShowUnlockWalletModal] = useState(false);
  const handleCloseUnlockWalletModal = () => setShowUnlockWalletModal(false);
  const handleOpenUnlockWalletModal = () => setShowUnlockWalletModal(true);

  const claimCollateral = async () => {
    try {
      await init();

      const isLoaded = is_wallet_loaded();
      if (!isLoaded) {
        handleOpenUnlockWalletModal();
        return;
      }

      await claimCollateralRequest();
    } catch (err) {
      console.error("Failed to claim collateral", err);
    }
  };

  const claimCollateralRequest = async () => {
    const res = await getClaimCollateralPsbt(contract.id);
    const claimTx = sign_claim_psbt(res.psbt, res.collateral_descriptor, contract.borrower_pk);

    const txid = await postClaimTx(contract.id, claimTx);

    alert(`Transaction ${txid} was published!`);

    navigate("/my-contracts");
  };

  const handleSubmitUnlockWalletModal = async () => {
    handleCloseUnlockWalletModal();
    await claimCollateralRequest();
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
              <strong>{collateralAmountBtc} BTC</strong> will be disbursed to <strong>{refundAddress}</strong>.
            </Alert>
          </Col>
        </Row>
        <Row className="justify-content-between mt-4">
          <Row className="mt-1">
            <Col className="d-grid">
              <Button
                variant="primary"
                onClick={async () => {
                  await claimCollateral();
                }}
              >
                Withdraw funds
              </Button>
            </Col>
          </Row>
        </Row>
      </Container>
    </>
  );
}
