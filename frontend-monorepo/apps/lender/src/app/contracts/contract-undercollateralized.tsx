import { faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { UnlockWalletModal, useWallet } from "@frontend/browser-wallet";
import { useLenderHttpClient } from "@frontend/http-client-lender";
import type { Contract } from "@frontend/http-client-lender";
import { FeeSelector } from "@frontend/mempool";
import { Callout, Heading } from "@radix-ui/themes";
import type { SignedTransaction } from "browser-wallet";
import { useState } from "react";
import { Alert, Col, Container, Form, Modal, Row } from "react-bootstrap";
import { IoInformationCircleOutline } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import { Button } from "@frontend/shadcn";
import { ConfirmLiquidationDialog } from "./liquidate-collateral-confirmation-dialog";

interface ContractUndercollateralizedProps {
  contract: Contract;
}

export function ContractUndercollateralized({
  contract,
}: ContractUndercollateralizedProps) {
  const { getLiquidationToBitcoinPsbt, postLiquidationTx } =
    useLenderHttpClient();
  const navigate = useNavigate();

  const [selectedFee, setSelectedFee] = useState(1);
  const [address, setAddress] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [liquidationTx, setLiquidationTx] = useState<SignedTransaction | null>(
    null,
  );

  const [error, setError] = useState("");

  const { isWalletLoaded, signLiquidationPsbt } = useWallet();

  const liquidateCollateralIfWalletLoaded = async () => {
    try {
      await liquidateCollateral();
    } catch (err) {
      console.error("Failed to liquidate collateral", err);
      throw err;
    }
  };

  const liquidateCollateral = async () => {
    console.log("Getting liquidation PSBT");

    if (address === "") {
      throw Error("Missing liquidation address");
    }

    const res = await getLiquidationToBitcoinPsbt(
      contract.id,
      selectedFee,
      address,
    );

    console.log(`Signing liquidation PSBT: ${JSON.stringify(res)}`);

    const tx = await signLiquidationPsbt(
      res.psbt,
      res.collateral_descriptor,
      res.lender_pk,
      contract.derivation_path,
    );

    console.log("Signed liquidation PSBT");

    setLiquidationTx(tx);
    setShowModal(true);
  };

  const handleConfirm = async () => {
    setShowModal(false);

    try {
      if (liquidationTx == null) {
        throw Error("Missing liquidation TX");
      }

      console.log("Posting signed liquidation TX");

      const txid = await postLiquidationTx(contract.id, liquidationTx.tx);

      alert(`Liquidation transaction ${txid} was published!`);

      navigate("/my-contracts");
    } catch (err) {
      console.error("Failed to post liquidation TX", err);
      setError(`Failed to post liquidation TX: ${err}`);
    }
  };

  const onUnlockOrLiquidate = async () => {
    setError("");

    if (isWalletLoaded) {
      try {
        await liquidateCollateralIfWalletLoaded();
      } catch (e) {
        const err = e as Error;
        setError(`Failed to liquidate collateral: ${err.message}`);
      }
    }
  };

  const handleFormSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onUnlockOrLiquidate();
  };

  return (
    <>
      {liquidationTx && (
        <ConfirmLiquidationDialog
          show={showModal}
          handleClose={() => setShowModal(false)}
          handleConfirm={handleConfirm}
          liquidationTx={liquidationTx}
        />
      )}
      <Container fluid>
        <Heading
          className={"text-font dark:text-font-dark"}
          size={"4"}
          weight={"medium"}
        >
          Liquidate Collateral
        </Heading>
        <Row className="mt-4">
          <Col>
            <div className="d-flex flex-column">
              <p className="text-break text-font dark:text-font-dark mt-2">
                To liquidate the collateral you will have to provide your{" "}
                <strong>password</strong>.
              </p>
            </div>
          </Col>
        </Row>
        <Row className="mt-2">
          <Col>
            <Alert variant="info">
              <FontAwesomeIcon icon={faInfoCircle} /> Your share of the
              collateral will be sent to the Bitcoin address you choose.
            </Alert>
          </Col>
        </Row>
        <Form onSubmit={handleFormSubmit}>
          <Form.Group controlId="formAddress" className="mb-3">
            <Row className="mt-2">
              <Col>
                <Form.Label
                  className={"text-font dark:text-font-dark font-bold"}
                >
                  Liquidation Address
                </Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Enter your Bitcoin address"
                  className="bg-light dark:bg-dark text-font dark:text-font-dark p-3 dark:placeholder-gray-500"
                  style={{
                    width: "100%",
                  }}
                  value={address}
                  required={true}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </Col>
            </Row>
            <Row className="mt-2">
              <FeeSelector onSelectFee={setSelectedFee}></FeeSelector>
            </Row>
            <div className="mt-3">
              {!isWalletLoaded ? (
                <UnlockWalletModal handleSubmit={() => {}}>
                  <Button
                    type={"button"}
                    disabled={isWalletLoaded}
                    className={"w-full"}
                  >
                    Confirm Secret
                  </Button>
                </UnlockWalletModal>
              ) : (
                <Button type="submit" className={"w-full"}>
                  Liquidate
                </Button>
              )}
              {error && (
                <Col className="d-grid mt-4">
                  <Callout.Root color="tomato">
                    <Callout.Icon>
                      <IoInformationCircleOutline />
                    </Callout.Icon>
                    <Callout.Text>{error}</Callout.Text>
                  </Callout.Root>
                </Col>
              )}
            </div>
          </Form.Group>
        </Form>
      </Container>
    </>
  );
}
