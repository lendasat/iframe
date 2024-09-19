import React, { useEffect, useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";

import { faInfoCircle, faWarning } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import init, { does_wallet_exist, new_wallet } from "../../../../../../borrower-wallet/pkg/borrower_wallet.js";

interface WalletModalProps {
  show: boolean;
  handleClose: () => void;
  handleSubmit: (password: string) => void;
}

export function CreateWalletModal({ show, handleClose, handleSubmit }: WalletModalProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (show) {
      // Reset all states when the modal is shown
      setPassword("");
      setConfirmPassword("");
      setError("");
      init()
        .then(() => {
          console.log("WASM module initialized");
        })
        .catch(err => console.error("Failed to initialize WASM module:", err));
    }
  }, [show]); // This effect runs every time 'show' changes

  const validatePasswords = () => {
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return false;
    }
    setError("");
    return true;
  };

  const onOkClick = () => {
    if (validatePasswords()) {
      try {
        const walletExists = does_wallet_exist();
        if (!walletExists) {
          // TODO: use env variable here for the network
          new_wallet(password, import.meta.env.VITE_BITCOIN_NETWORK ?? "signet");
          console.log("Created new wallet");
        } else {
          setError("Wallet already exists, please unlock instead");
          return;
        }
      } catch (error) {
        setError(error);
        return;
      }

      handleSubmit(password);
      handleClose();
    }
  };

  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Set contract secret</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {(!error)
          ? (
            <div className="alert alert-info">
              <FontAwesomeIcon icon={faInfoCircle} color={"primary"} />{" "}
              Please enter a secret for your contracts. Keep this password safe. You will need it when unlocking your
              funds.
            </div>
          )
          : ""}
        {error && (
          <div className="alert alert-danger">
            <FontAwesomeIcon icon={faWarning} color={"primary"} /> {error}
          </div>
        )}
        <Form>
          <Form.Group controlId="formPassword" className="mb-3">
            <Form.Control
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
            />
          </Form.Group>
          <Form.Group controlId="formConfirmPassword" className="mb-3">
            <Form.Control
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
            />
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onOkClick}>
          OK
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
