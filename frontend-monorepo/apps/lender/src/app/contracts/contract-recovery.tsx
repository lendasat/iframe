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

interface ContractRecoveryProps {
  contract: Contract;
}

export function ContractRecovery({
  contract,
}: ContractRecoveryProps) {
  const { getRecoveryPsbt, postLiquidationTx } = useLenderHttpClient();
  const navigate = useNavigate();

  const [selectedFee, setSelectedFee] = useState(1);
  const [address, setAddress] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [tx, setTx] = useState<SignedTransaction | null>(null);

  const [showUnlockWalletModal, setShowUnlockWalletModal] = useState(false);

  const [error, setError] = useState("");

  const handleCloseUnlockWalletModal = () => setShowUnlockWalletModal(false);
  const handleOpenUnlockWalletModal = () => setShowUnlockWalletModal(true);

  const { isWalletLoaded, signLiquidationPsbt } = useWallet();

  const recoverCollateralIfWalletLoaded = async () => {
    try {
      if (!isWalletLoaded) {
        handleOpenUnlockWalletModal();
        return;
      } else {
        await recoverCollateral();
      }
    } catch (err) {
      console.error("Failed to recover collateral", err);
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

  const recoverCollateral = async () => {
    console.log("Getting recovery PSBT");

    if (address === "") {
      throw Error("Missing lender address");
    }

    const res = await getRecoveryPsbt(contract.id, selectedFee, address);

    console.log(`Signing recovery PSBT: ${JSON.stringify(res)}`);

    const tx = await signLiquidationPsbt(
      res.psbt,
      res.collateral_descriptor,
      res.lender_pk,
    );

    console.log("Signed recovery PSBT");

    setTx(tx);
    setShowModal(true);
  };

  const handleConfirm = async () => {
    setShowModal(false);

    try {
      if (tx == null) {
        throw Error("Missing recovery TX");
      }

      console.log("Posting signed recovery TX");

      const txid = await postLiquidationTx(contract.id, tx.tx);

      alert(`Collateral recovery transaction ${txid} was published!`);

      navigate("/my-contracts");
    } catch (err) {
      console.error("Failed to post recovery TX", err);
      setError(`Failed to post recovery TX: ${err}`);
    }
  };

  const handleSubmitUnlockWalletModal = async () => {
    handleCloseUnlockWalletModal();
  };

  const onUnlockOrRecoverCollateral = async () => {
    setError("");

    if (isWalletLoaded) {
      try {
        await recoverCollateralIfWalletLoaded();
      } catch (e) {
        const err = e as Error;
        setError(`Failed to recover collateral: ${err.message}`);
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
    onUnlockOrRecoverCollateral();
  };

  return (
    <>
      <UnlockWalletModal
        show={showUnlockWalletModal}
        handleClose={handleCloseUnlockWalletModal}
        handleSubmit={handleSubmitUnlockWalletModal}
      />
      {tx && (
        <ConfirmationModal
          show={showModal}
          handleClose={() => setShowModal(false)}
          handleConfirm={handleConfirm}
          tx={tx}
        />
      )}
      <Container fluid>
        <Heading className={"text-font dark:text-font-dark"} size={"4"} weight={"medium"}>
          Recover Collateral
        </Heading>
        <Row className="mt-4">
          <Col>
            <div className="d-flex flex-column">
              <p className="mt-2 text-break text-font dark:text-font-dark">
                To recover the collateral you will have to provide your <strong>password</strong>.
              </p>
            </div>
          </Col>
        </Row>
        <Row className="mt-2">
          <Col>
            <Alert variant="info">
              <FontAwesomeIcon icon={faInfoCircle} />{" "}
              If the borrower has yet to pay back the loan, your share of the collateral will be sent to the Bitcoin
              address you choose.
            </Alert>
          </Col>
        </Row>
        <Form onSubmit={handleFormSubmit}>
          <Form.Group controlId="formAddress" className="mb-3">
            <Row className="mt-2">
              <Col>
                <Form.Label className={"font-bold text-font dark:text-font-dark"}>
                  Your Bitcoin Address
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
  tx: SignedTransaction;
};

const ConfirmationModal = ({ show, handleClose, handleConfirm, tx }: ConfirmationModalProps) => {
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
              Confirm Collateral Recovery
            </Heading>
          </Box>
          <Box className="mb-3">
            <Flex className="flex flex-col gap-3">
              <Alert variant={"info"} className="flex items-baseline gap-2">
                <Box>
                  <FontAwesomeIcon icon={faInfoCircle} />
                </Box>
                <Text>
                  Make sure that you agree with the transaction before confirming. Keep in mind that Lendasat may return
                  a transaction that does not pay to you if the borrower has already paid back the loan.
                </Text>
              </Alert>
            </Flex>
          </Box>
          <Box className="mb-3">
            <Flex className="flex flex-col gap-3 dark:text-font-dark">
              <Text>Sending:</Text>
              <ul className="list-disc list-inside pl-5">
                {tx.outputs.map((o, index) => (
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
