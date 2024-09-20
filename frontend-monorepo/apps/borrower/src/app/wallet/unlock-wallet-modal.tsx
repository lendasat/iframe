import React, { useEffect, useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";

import { faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useWallet } from "@frontend-monorepo/borrower-wallet";

interface WalletModalProps {
  show: boolean;
  handleClose: () => void;
  handleSubmit: () => void;
}

export function UnlockWalletModal({ show, handleClose, handleSubmit }: WalletModalProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { loadWallet, isWalletLoaded, doesWalletExist } = useWallet();

  useEffect(() => {
    if (show) {
      // Reset all states when the modal is shown
      setPassword("");
      setError("");
    }
  }, [show]); // This effect runs every time 'show' changes

  const onOkClick = async () => {
    setLoading(true);
    await delay(100);
    try {
      if (!doesWalletExist) {
        setError("Wallet does not exist");
        return;
      }
      if (!isWalletLoaded) {
        loadWallet(password);
        console.log("Wallet loaded successfully");
      } else {
        console.log("Wallet already loaded");
        return;
      }
    } catch (error) {
      setError(`${error}`);
      return;
    } finally {
      setLoading(false);
    }

    handleSubmit();
  };

  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Set contract password</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {(!error)
          ? (
            <div className="alert alert-info">
              <FontAwesomeIcon icon={faInfoCircle} color={"primary"} />{" "}
              Please enter your wallet secret to unlock your wallet.
            </div>
          )
          : ""}
        {error && <div className="alert alert-danger">{error}</div>}
        <Form>
          <Form.Group controlId="formPassword" className="mb-3">
            <Form.Control
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
            />
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onOkClick} disabled={loading}>
          {loading ? "Loading…" : "Submit"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
