import * as React from "react";
import { LuBitcoin, LuSettings, LuUser } from "react-icons/lu";
import { defineStepper } from "@/components/ui/stepper.tsx";
import { Button } from "@/components/ui/button.tsx";
import { ConfigureLoan } from "@/ConfigureLoan.tsx";
import AuthWizard from "@/AuthWizard.tsx";
import LoanTerms from "./LoanTerms";
import { useState } from "react";
import {
  Contract,
  LoanType,
  useHttpClientBorrower,
} from "@frontend/http-client-borrower";
import { LoginResponseOrUpgrade } from "@frontend/base-http-client";
import { useWallet } from "@frontend/browser-wallet";
import { toast } from "sonner";

const {
  StepperProvider,
  StepperControls,
  StepperNavigation,
  StepperPanel,
  StepperStep,
  StepperTitle,
} = defineStepper(
  {
    id: "step-1",
    title: "Configure",
    icon: <LuSettings />,
  },
  {
    id: "step-2",
    title: "Authenticate",
    icon: <LuUser />,
  },
  {
    id: "step-3",
    title: "Confirm",
    icon: <LuBitcoin />,
  },
);

interface StepperProps {
  amount: number;
  lenderId: string;
  inviteCode: string;
  login: (email: string, password: string) => Promise<LoginResponseOrUpgrade>;
  onPrincipalGiven: (contractId: string) => void;
  onDone: (contractId: string) => void;
}

export default function Stepper({
  amount,
  lenderId,
  inviteCode,
  login,
  onPrincipalGiven,
  onDone,
}: StepperProps) {
  // TODO: We force the user to authenticate every time. This is not
  // always necessary.
  const [authComplete, setAuthComplete] = useState(false);

  const [loanOfferId, setLoanOfferId] = useState<string | undefined>(undefined);
  const [days, setDays] = useState(7);
  const [contractId, setContractId] = useState<string | undefined>(undefined);

  const { postContractRequest } = useHttpClientBorrower();

  const { getNpub, getPkAndDerivationPath, getNextAddress } = useWallet();

  return (
    <StepperProvider className="space-y-4" variant="horizontal">
      {({ methods }) => (
        <React.Fragment>
          <StepperNavigation>
            {methods.all.map((step) => (
              <StepperStep key={step.id} of={step.id} icon={step.icon}>
                <StepperTitle>{step.title}</StepperTitle>
              </StepperStep>
            ))}
          </StepperNavigation>
          {methods.switch({
            "step-1": () => (
              <StepperPanel className="content-center rounded border bg-slate-50 p-8">
                <ConfigureLoan
                  loanAmount={amount}
                  lenderId={lenderId}
                  days={days}
                  setDays={setDays}
                  setLoanOfferId={setLoanOfferId}
                />
              </StepperPanel>
            ),
            "step-2": () => (
              <StepperPanel className="content-center rounded border bg-slate-50 p-8">
                <AuthWizard
                  login={login}
                  inviteCode={inviteCode}
                  onComplete={() => setAuthComplete(true)}
                />
              </StepperPanel>
            ),
            "step-3": () => (
              <StepperPanel className="content-center rounded border bg-slate-50 p-8">
                <LoanTerms
                  sendContractRequest={sendContractRequest}
                  onPrincipalGiven={(contractId: string) => {
                    setContractId(contractId);
                    onPrincipalGiven(contractId);
                  }}
                />
              </StepperPanel>
            ),
          })}
          <StepperControls>
            {!methods.isLast && (
              <Button
                variant="secondary"
                onClick={methods.prev}
                disabled={methods.isFirst}
              >
                Previous
              </Button>
            )}
            {methods.switch({
              "step-1": () => (
                <Button
                  onClick={methods.next}
                  disabled={loanOfferId === undefined}
                >
                  {"Next"}
                </Button>
              ),
              "step-2": () => (
                <Button onClick={methods.next} disabled={!authComplete}>
                  {"Next"}
                </Button>
              ),
              "step-3": () => (
                <Button
                  onClick={() => {
                    if (contractId) {
                      onDone(contractId);
                    } else {
                      toast.error("Contract not ready yet.");
                    }
                  }}
                  disabled={!contractId}
                >
                  {"Back to shop"}
                </Button>
              ),
            })}
          </StepperControls>
        </React.Fragment>
      )}
    </StepperProvider>
  );

  async function sendContractRequest(): Promise<Contract | undefined> {
    const npub = await getNpub();
    const pkAndPath = await getPkAndDerivationPath();
    const address = await getNextAddress();

    if (!loanOfferId) {
      throw new Error("Must choose an offer before sending contract request");
    }

    return await postContractRequest({
      id: loanOfferId,
      loan_amount: amount,
      duration_days: days,
      borrower_btc_address: address,
      borrower_npub: npub,
      borrower_pk: pkAndPath.pubkey,
      borrower_derivation_path: pkAndPath.path,
      loan_type: LoanType.StableCoin,
    });
  }
}
