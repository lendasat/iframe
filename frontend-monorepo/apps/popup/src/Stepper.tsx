import * as React from "react";
import { HomeIcon, SettingsIcon, UserIcon } from "lucide-react";
import { defineStepper } from "@/components/ui/stepper.tsx";
import { Button } from "@/components/ui/button.tsx";
import { ConfigureLoan } from "@/ConfigureLoan.tsx";
import AuthWizard from "@/AuthWizard.tsx";
import LoanTerms from "./LoanTerms";

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
    title: "Step 1",
    icon: <HomeIcon />,
  },
  {
    id: "step-2",
    title: "Step 2",
    icon: <SettingsIcon />,
  },
  {
    id: "step-3",
    title: "Step 3",
    icon: <UserIcon />,
  },
);

export default function Stepper() {
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
            "step-1": (step) => <Content id={step.id} />,
            "step-2": (step) => <Content id={step.id} />,
            "step-3": (step) => <Content id={step.id} />,
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
            <Button onClick={methods.isLast ? methods.reset : methods.next}>
              {methods.isLast ? "Reset" : "Next"}
            </Button>
          </StepperControls>
        </React.Fragment>
      )}
    </StepperProvider>
  );
}

const Content = ({ id }: { id: string }) => {
  let content = <ConfigureLoan />;
  switch (id) {
    case "step-1":
      content = <ConfigureLoan />;
      break;
    case "step-2":
      content = <AuthWizard />;
      break;
    case "step-3":
      content = <LoanTerms />;
      break;
  }

  return (
    <StepperPanel className="content-center rounded border bg-slate-50 p-8">
      {content}
    </StepperPanel>
  );
};
