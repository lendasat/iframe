import { faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { UnlockWalletModal, useWallet } from "@frontend/browser-wallet";
import { useLenderHttpClient, Contract } from "@frontend/http-client-lender";
import { useFees } from "@frontend/mempool";
import { formatCurrency } from "@frontend/ui-shared";
import { Box, Button, Callout, Flex, Heading, Text } from "@radix-ui/themes";
import { Network, validate } from "bitcoin-address-validation";
import type { SignedTransaction } from "browser-wallet";
import { useState } from "react";
import { Alert, Col, Form, Modal, Row } from "react-bootstrap";
import { IoInformationCircleOutline } from "react-icons/io5";
import { useNavigate } from "react-router-dom";

export interface LiquidateToStablecoinProps {
  contract: Contract;
}

export function LiquidateToStablecoin({
  contract,
}: LiquidateToStablecoinProps) {
  const { recommendedFees } = useFees();
  const { isWalletLoaded, signLiquidationPsbt } = useWallet();
  const navigate = useNavigate();
  const { getLiquidationToStablecoinPsbt, postLiquidationTx } =
    useLenderHttpClient();

  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [liquidationTx, setLiquidationTx] = useState<SignedTransaction | null>(
    null,
  );
  const [confirmSettleAddress, setConfirmSettleAddress] = useState("");
  const [confirmSettleAmount, setConfirmSettleAmount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const [showUnlockWalletModal, setShowUnlockWalletModal] = useState(false);
  const handleCloseUnlockWalletModal = () => setShowUnlockWalletModal(false);
  const handleOpenUnlockWalletModal = () => setShowUnlockWalletModal(true);

  const handleSubmitUnlockWalletModal = async () => {
    handleCloseUnlockWalletModal();
  };

  const [showModal, setShowModal] = useState(false);

  const onBitcoinAddressChange = (address: string) => {
    let network = Network.mainnet;
    if (import.meta.env.VITE_BITCOIN_NETWORK === "signet") {
      network = Network.testnet;
    } else if (import.meta.env.VITE_BITCOIN_NETWORK === "regtest") {
      network = Network.regtest;
    }

    const valid = validate(address, network);
    if (!valid) {
      setError("Invalid liquidation address");
    } else {
      setError("");
    }
    setAddress(address);
  };

  const liquidateCollateralIfWalletLoaded = async () => {
    try {
      if (!isWalletLoaded) {
        handleOpenUnlockWalletModal();
        return;
      } else {
        await liquidateCollateral();
      }
    } catch (err) {
      console.error("Failed to liquidate collateral", err);
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

  const liquidateCollateral = async () => {
    if (!recommendedFees?.fastestFee) {
      setError("Can't liquidate without a fee rate, please retry");
      return;
    }

    console.log("Getting liquidation PSBT");

    if (address === "") {
      throw Error("Missing liquidation address");
    }

    const res = await getLiquidationToStablecoinPsbt(
      contract.id,
      recommendedFees.fastestFee,
      address,
    );

    console.log(`Signing liquidation PSBT: ${JSON.stringify(res)}`);

    const tx = await signLiquidationPsbt(
      res.psbt,
      res.collateral_descriptor,
      res.lender_pk,
      contract.derivation_path,
    );

    console.log(`Signed liquidation PSBT '${tx.tx}'`);

    setLiquidationTx(tx);
    setConfirmSettleAddress(res.settle_address);
    setConfirmSettleAmount(res.settle_amount);
    setShowModal(true);
  };

  const handleConfirm = async () => {
    setShowModal(false);

    try {
      if (liquidationTx == null) {
        setError(`Missing liquidation TX`);
        return;
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
      if (!address) {
        setError("Bitcoin address not set");
      }

      try {
        await liquidateCollateralIfWalletLoaded();
      } catch (e) {
        const err = e as Error;
        setError(`Failed to liquidate collateral: ${err.message}`);
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

  const handleFormSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setIsLoading(true);
    await onUnlockOrLiquidate();
    setIsLoading(false);
  };

  return (
    <>
      <UnlockWalletModal
        show={showUnlockWalletModal}
        handleClose={handleCloseUnlockWalletModal}
        handleSubmit={handleSubmitUnlockWalletModal}
      />
      {liquidationTx && (
        <ConfirmationModal
          show={showModal}
          handleClose={() => setShowModal(false)}
          handleConfirm={handleConfirm}
          confirmSettleAddress={confirmSettleAddress}
          confirmSettleAmount={confirmSettleAmount}
        />
      )}
      <Row className="mt-2">
        <Col>
          <Alert variant="info">
            <FontAwesomeIcon icon={faInfoCircle} /> You will receive your funds
            at <strong>{contract.loan_repayment_address}</strong>.
            <br />
            <br />
            <strong>Note:</strong> We are using a third party service for the
            liquidation. In the unlikely event where the liquidation fails, you
            will receive the bitcoin. Because of this, please provide below a
            fallback bitcoin address.
          </Alert>
        </Col>
      </Row>
      <Form onSubmit={handleFormSubmit}>
        <Form.Group controlId="formAddress" className="mb-3">
          <Row className="mt-2">
            <Col>
              <Form.Label
                className={"text-font dark:text-font-dark font-bold"}
                column={false}
              >
                Fallback Bitcoin Address
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
                onChange={(c) => {
                  c.preventDefault();
                  const value = c.target.value;
                  onBitcoinAddressChange(value);
                }}
              />
            </Col>
          </Row>
          <Row className="justify-content-between mt-4">
            <Row className="mt-1">
              <Col className="d-grid">
                <Button type="submit" loading={isLoading} size={"3"}>
                  {isWalletLoaded ? "Liquidate" : "Unlock Contract"}
                </Button>
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
              </Col>
            </Row>
          </Row>
        </Form.Group>
      </Form>
    </>
  );
}

type ConfirmationModalProps = {
  show: boolean;
  handleClose: () => void;
  handleConfirm: () => void;
  confirmSettleAddress: string;
  confirmSettleAmount: number;
};

const ConfirmationModal = ({
  show,
  handleClose,
  handleConfirm,
  confirmSettleAddress,
  confirmSettleAmount,
}: ConfirmationModalProps) => {
  return (
    <Modal show={show} onHide={handleClose} centered>
      <Box className={"dark:bg-dark-700 rounded-2 bg-white"}>
        <Box className="px-4 pt-7">
          <Box>
            <Heading
              as="h2"
              className="text-font dark:text-font-dark mb-7 text-center text-xl font-semibold md:text-2xl lg:text-4xl"
            >
              Confirm Liquidation
            </Heading>
          </Box>
          <Box className="mb-3">
            <Flex className="flex flex-col gap-3">
              <Alert variant={"info"} className="flex items-baseline gap-2">
                <Box>
                  <FontAwesomeIcon icon={faInfoCircle} />
                </Box>
                <Text>
                  Please verify that the liquidation transaction pays the
                  expected amount to your chosen address.
                </Text>
              </Alert>
            </Flex>
          </Box>
          <Box className="mb-3">
            <Flex className="dark:text-font-dark flex flex-col gap-3">
              <Text>Sending:</Text>
              <ul className="list-inside list-disc pl-5">
                <li className="overflow-hidden text-ellipsis whitespace-nowrap">
                  <strong>{formatCurrency(confirmSettleAmount)}</strong> to{" "}
                  <em>{confirmSettleAddress}</em>.
                </li>
              </ul>
            </Flex>
          </Box>
        </Box>
        <Box className="dark:bg-dark-700 rounded-2 mt-4 flex items-center justify-center bg-white px-4 pb-5">
          <Button
            variant="solid"
            className="bg-btn h-12 w-full max-w-md rounded-lg text-white"
            onClick={handleConfirm}
          >
            Confirm
          </Button>
        </Box>
      </Box>
    </Modal>
  );
};
