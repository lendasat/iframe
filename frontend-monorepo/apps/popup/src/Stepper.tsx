import * as React from "react";
import { Bitcoin, SettingsIcon, UserIcon } from "lucide-react";
import { defineStepper } from "@/components/ui/stepper.tsx";
import { Button } from "@/components/ui/button.tsx";
import { ConfigureLoan } from "@/ConfigureLoan.tsx";
import AuthWizard from "@/AuthWizard.tsx";
import LoanTerms from "./LoanTerms";
import { useState } from "react";

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
    icon: <SettingsIcon />,
  },
  {
    id: "step-2",
    title: "Authenticate",
    icon: <UserIcon />,
  },
  {
    id: "step-3",
    title: "Confirm",
    icon: <Bitcoin />,
  },
);

interface StepperProps {
  amount: number;
}

export default function Stepper({ amount }: StepperProps) {
  const [step1Completed, _setStep1Completed] = useState(true);
  const [step2Completed, setStep2Completed] = useState(false);
  const [step3Completed, _setStep3Completed] = useState(true);
  const [months, setMonths] = useState(3);

  const ltvRatio = 50;
  // This formula is completely arbitrary.
  const yearlyInterestRate = 9.5 + months * 0.25;

  return (
    <StepperProvider className="space-y-4" variant="horizontal">
      {({ methods }) => (
        <React.Fragment>
          <StepperNavigation>
            {methods.all.map((step) => (
              <StepperStep
                key={step.id}
                of={step.id}
                onClick={() => methods.goTo(step.id)}
                icon={step.icon}
              >
                <StepperTitle>{step.title}</StepperTitle>
              </StepperStep>
            ))}
          </StepperNavigation>
          {methods.switch({
            "step-1": () => (
              <StepperPanel className="content-center rounded border bg-slate-50 p-8">
                <ConfigureLoan
                  loanAmount={amount}
                  months={months}
                  setMonths={setMonths}
                  ltvRatio={ltvRatio}
                  yearlyInterestRate={yearlyInterestRate}
                />
              </StepperPanel>
            ),
            "step-2": () => (
              <StepperPanel className="content-center rounded border bg-slate-50 p-8">
                <AuthWizard />
              </StepperPanel>
            ),
            "step-3": () => (
              <StepperPanel className="content-center rounded border bg-slate-50 p-8">
                <LoanTerms
                  loanAmount={amount}
                  months={months}
                  yearlyInterestRate={yearlyInterestRate}
                  ltvRatio={ltvRatio}
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
                  onClick={methods.isLast ? methods.reset : methods.next}
                  disabled={!step1Completed}
                >
                  {"Next"}
                </Button>
              ),
              "step-2": () => (
                <Button
                  onClick={methods.isLast ? methods.reset : methods.next}
                  disabled={!step2Completed}
                >
                  {"Next"}
                </Button>
              ),
              "step-3": () => (
                <Button
                  onClick={methods.isLast ? methods.reset : methods.next}
                  disabled={!step3Completed}
                >
                  {"Reset"}
                </Button>
              ),
            })}
          </StepperControls>
        </React.Fragment>
      )}
    </StepperProvider>
  );
}
