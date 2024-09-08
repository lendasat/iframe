import {faInfoCircle} from "@fortawesome/free-solid-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {Contract, ContractStatus, useAuth} from "@frontend-monorepo/http-client";
import QRCode from "qrcode.react";
import {Suspense, useState} from "react";
import {Alert, Button, Col, Container, Form, InputGroup, Row} from "react-bootstrap";
import {Await, useNavigate, useParams} from "react-router-dom";
import init, {is_wallet_loaded, sign_claim_psbt} from "../../../../../../borrower-wallet/pkg/borrower_wallet.js";
import {Lender} from "../request-loan/lender";
import Usd, {formatCurrency} from "../usd";
import {UnlockWalletModal} from "../wallet/unlock-wallet-modal";

export function RepayLoan() {
  const { getContract } = useAuth();
  const { id } = useParams();

  return (
    <div>
      <Suspense>
        <Await
          resolve={getContract(id)}
          errorElement={<div>Could not load contract</div>}
          children={(resolvedContract: Awaited<Contract>) => (
            <RepayLoanComponent
              contract={resolvedContract}
            />
          )}
        />
      </Suspense>
    </div>
  );
}

interface RepayLoanComponentProps {
  contract: Contract;
}

function RepayLoanComponent({ contract }: RepayLoanComponentProps) {
  const collateral = contract.collateral_sats / 100000000;
  const loanAmount = contract.loan_amount;
  const accruedInterest = contract.loan_amount * (contract.interest_rate / 100);
  const refundAddress = contract.borrower_btc_address;
  const totalRepaymentAmount = accruedInterest + loanAmount;
  const repaymentAddress = contract.loan_repayment_address;
  const interestRate = contract.interest_rate;

  const isRepaid = contract.status == ContractStatus.PrincipalGiven;

  const [showUnlockWalletModal, setShowUnlockWalletModal] = useState(false);
  const handleCloseUnlockWalletModal = () => setShowUnlockWalletModal(false);
  const handleOpenUnlockWalletModal = () => setShowUnlockWalletModal(true);

  const navigate = useNavigate();

  const handleSubmitUnlockWalletModal = async () => {
    handleCloseUnlockWalletModal();
    await claimCollateralRequest();
  };

  const { getClaimCollateralPsbt, postClaimTx } = useAuth();
  const claimCollateral = async (contract: Contract) => {
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
  }

  return (
    <Container className={"p-4"} fluid>
      <UnlockWalletModal
        show={showUnlockWalletModal}
        handleClose={handleCloseUnlockWalletModal}
        handleSubmit={handleSubmitUnlockWalletModal}
      />
      <Row className="mt-3">
        <Col xs={12} md={6}>
          <Container fluid>
            <Row>
              <h4>Contract Details</h4>
            </Row>
            <Row className="justify-content-between border-b mt-2">
              <Col>Lender</Col>
              <Col className="text-end mb-2">
                <Lender {...contract.lender} />
              </Col>
            </Row>
            <Row className="justify-content-between border-b mt-2">
              <Col>Collateral</Col>
              <Col className="text-end mb-2">{collateral.toFixed(4)} BTC</Col>
            </Row>
            <Row className="justify-content-between border-b mt-2">
              <Col>Interest rate</Col>
              <Col className="text-end mb-2">
                {interestRate}%
              </Col>
            </Row>

            <Row className="justify-content-between mt-4">
              <Col md={6}>Loan Amount</Col>
              <Col md={6} className="text-end">
                <Usd value={loanAmount} />
              </Col>
            </Row>
            <Row className="justify-content-between mt-2">
              <Col md={6}>Accrued Interest</Col>
              <Col md={6} className="text-end">
                <Usd value={accruedInterest} />
              </Col>
            </Row>
            <Row className="mt-2 border-top pt-2">
              <Col md={6}>
                <strong>Total amount to be paid:</strong>
              </Col>
              <Col md={6} className="text-end">
                <strong>
                  <Usd value={totalRepaymentAmount} />
                </strong>
              </Col>
            </Row>

            <Row className="justify-content-between mt-4">
              <Alert className="mb-2" key="info" variant="success">
                <FontAwesomeIcon icon={faInfoCircle} /> Your collateral will be returned to this address.
                <InputGroup className="mt-2">
                  <Form.Control
                    type="text"
                    value={refundAddress}
                    disabled
                    readOnly
                    className="bg-white"
                  />
                </InputGroup>
              </Alert>
            </Row>

            {isRepaid
              ? (
                <Row className="justify-content-between mt-4">
                  <Row className="mt-1">
                    <Col className="d-grid">
                      <Button
                        variant="primary"
                        onClick={async () => {
                          await claimCollateral(contract);
                        }}
                      >
                        Withdraw funds
                      </Button>
                    </Col>
                  </Row>
                </Row>
              )
              : ""}
          </Container>
        </Col>
        <Col xs={12} md={6}>
          {!isRepaid
            ? (
              <RepaymentDetails
                totalRepaymentAmount={totalRepaymentAmount}
                repaymentAddress={repaymentAddress}
              />
            )
            : ""}
        </Col>
      </Row>
    </Container>
  );
}

interface RepaymentDetailsProps {
  totalRepaymentAmount: number;
  repaymentAddress: string;
}

export function RepaymentDetails({
  totalRepaymentAmount,
  repaymentAddress,
}: RepaymentDetailsProps) {
  return (
    <Container fluid>
      <Row>
        <h4>Repayment Details</h4>
      </Row>

      <Row className="mt-4">
        <Col className="text-center">
          <div className="d-flex justify-content-center align-items-center flex-column">
            <QRCode value={repaymentAddress} size={200} />
            <p className="mt-2 text-break">
              Please send {formatCurrency(totalRepaymentAmount)} to {repaymentAddress}
            </p>
          </div>
        </Col>
      </Row>
      <Row className="mt-2">
        <Col>
          <Alert variant="info">
            <FontAwesomeIcon icon={faInfoCircle} />{" "}
            Once the lender confirms they received the funds, you will be able to withdraw the collateral from the
            contract.
          </Alert>
        </Col>
      </Row>
    </Container>
  );
}
