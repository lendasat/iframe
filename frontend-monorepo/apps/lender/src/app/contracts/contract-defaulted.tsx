import { faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { UnlockWalletModal, useWallet } from "@frontend-monorepo/browser-wallet";
import { useLenderHttpClient } from "@frontend-monorepo/http-client-lender";
import type { Contract } from "@frontend-monorepo/http-client-lender";
import { FeeSelector } from "@frontend-monorepo/mempool";
import { Box, Callout, Flex, Heading, Text } from "@radix-ui/themes";
import type { SignedTransaction } from "browser-wallet";
import { useState } from "react";
import { Alert, Button, Col, Container, Form, Modal, Row } from "react-bootstrap";
import { IoInformationCircleOutline } from "react-icons/io5";
import { useNavigate } from "react-router-dom";

interface ContractDefaultedProps {
  contract: Contract;
}

export function ContractDefaulted({
  contract,
}: ContractDefaultedProps) {
  const { getLiquidationPsbt, postLiquidationTx } = useLenderHttpClient();
  const navigate = useNavigate();

  const [selectedFee, setSelectedFee] = useState(1);
  const [address, setAddress] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [liquidationTx, setLiquidationTx] = useState<SignedTransaction | null>(null);

  const [showUnlockWalletModal, setShowUnlockWalletModal] = useState(false);

  const [error, setError] = useState("");

  const handleCloseUnlockWalletModal = () => setShowUnlockWalletModal(false);
  const handleOpenUnlockWalletModal = () => setShowUnlockWalletModal(true);

  const { isWalletLoaded, signLiquidationPsbt } = useWallet();

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
    console.log("Getting liquidation PSBT");

    if (address === "") {
      throw Error("Missing liquidation address");
    }

    const res = await getLiquidationPsbt(contract.id, selectedFee, address);

    console.log(`Signing liquidation PSBT: ${JSON.stringify(res)}`);

    const tx = await signLiquidationPsbt(
      res.psbt,
      res.collateral_descriptor,
      res.lender_pk,
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

  const handleSubmitUnlockWalletModal = async () => {
    handleCloseUnlockWalletModal();
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
    } else {
      try {
        await unlockWallet();
      } catch (e) {
        const err = e as Error;
        setError(`Failed to unlock contract: ${err.message}`);
      }
    }
  };

  const handleFormSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onUnlockOrLiquidate();
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
          liquidationTx={liquidationTx}
        />
      )}
      <Container fluid>
        <Heading className={"text-font dark:text-font-dark"} size={"4"} weight={"medium"}>
          Liquidate Collateral
        </Heading>
        <Row className="mt-4">
          <Col>
            <div className="d-flex flex-column">
              <p className="mt-2 text-break text-font dark:text-font-dark">
                To liquidate the collateral you will have to provide your <strong>contract secret</strong>.
              </p>
            </div>
          </Col>
        </Row>
        <Row className="mt-2">
          <Col>
            <Alert variant="info">
              <FontAwesomeIcon icon={faInfoCircle} />{" "}
              Your share of the collateral will be sent to the Bitcoin address you choose.
            </Alert>
          </Col>
        </Row>
        <Form onSubmit={handleFormSubmit}>
          <Form.Group controlId="formAddress" className="mb-3">
            <Row className="mt-2">
              <Col>
                <Form.Label className={"font-bold text-font dark:text-font-dark"}>
                  Liquidation Address
                </Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Enter your Bitcoin address"
                  className="p-3 bg-light dark:bg-dark text-font dark:text-font-dark dark:placeholder-gray-500"
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
            <Row className="justify-content-between mt-4">
              <Row className="mt-1">
                <Col className="d-grid">
                  <Button
                    type="submit"
                    variant="primary"
                  >
                    {isWalletLoaded ? "Liquidate" : "Unlock Contract"}
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
          </Form.Group>
        </Form>
      </Container>
    </>
  );
}

type ConfirmationModalProps = {
  show: boolean;
  handleClose: () => void;
  handleConfirm: () => void;
  liquidationTx: SignedTransaction;
};

const ConfirmationModal = ({ show, handleClose, handleConfirm, liquidationTx }: ConfirmationModalProps) => {
  const formatter = new Intl.NumberFormat("en-US");

  return (
    <Modal show={show} onHide={handleClose} centered>
      <Box className={"bg-white dark:bg-dark-700 rounded-2"}>
        <Box className="px-4 pt-7">
          <Box>
            <Heading
              as="h2"
              className="text-xl md:text-2xl lg:text-4xl font-semibold text-center text-font dark:text-font-dark mb-7"
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
                  Please verify that the liquidation transaction pays the expected amount to your chosen address.
                </Text>
              </Alert>
            </Flex>
          </Box>
          <Box className="mb-3">
            <Flex className="flex flex-col gap-3 dark:text-font-dark">
              <Text>Sending:</Text>
              <ul className="list-disc list-inside pl-5">
                {liquidationTx.outputs.map((o, index) => (
                  <li key={index} className="whitespace-nowrap overflow-hidden text-ellipsis">
                    <strong>{formatter.format(o.value)}</strong> sats to <em>{o.address}</em>.
                  </li>
                ))}
              </ul>
            </Flex>
          </Box>
        </Box>
        <Box className="mt-4 px-4 pb-5 bg-white dark:bg-dark-700 rounded-2 flex justify-center items-center">
          <Button
            variant="solid"
            className="w-full max-w-md h-12 bg-btn text-white rounded-lg"
            onClick={handleConfirm}
          >
            Confirm
          </Button>
        </Box>
      </Box>
    </Modal>
  );
};
