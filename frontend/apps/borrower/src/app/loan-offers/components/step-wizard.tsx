import { Check } from "lucide-react";
import { cn } from "@frontend/shadcn";

interface Step {
  id: string;
  title: string;
  description: string;
  isComplete: boolean;
  isActive: boolean;
}

interface StepWizardProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (stepIndex: number) => void;
}

export const StepWizard = ({
  steps,
  currentStep,
  onStepClick,
}: StepWizardProps) => {
  return (
    <div className="w-full">
      <nav aria-label="Progress">
        <ol className="flex items-center justify-between w-full">
          {steps.map((step, stepIndex) => (
            <li key={step.id} className="relative flex-1">
              {/* Step connector line */}
              {stepIndex !== steps.length - 1 && (
                <div
                  className={cn(
                    "absolute top-4 left-1/2 w-full h-0.5 -translate-y-1/2",
                    stepIndex < currentStep ? "bg-primary" : "bg-muted",
                  )}
                  style={{
                    left: "calc(50% + 16px)",
                    width: "calc(100% - 32px)",
                  }}
                />
              )}

              {/* Step button */}
              <button
                type="button"
                onClick={() => onStepClick?.(stepIndex)}
                disabled={stepIndex > currentStep}
                className={cn(
                  "relative flex flex-col items-center group w-full",
                  stepIndex <= currentStep
                    ? "cursor-pointer"
                    : "cursor-not-allowed",
                )}
              >
                {/* Step circle */}
                <div
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors",
                    stepIndex < currentStep
                      ? "bg-primary border-primary text-primary-foreground"
                      : stepIndex === currentStep
                        ? "bg-background border-primary text-primary"
                        : "bg-background border-muted-foreground text-muted-foreground",
                  )}
                >
                  {stepIndex < currentStep ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span className="text-sm font-medium">{stepIndex + 1}</span>
                  )}
                </div>

                {/* Step content */}
                <div className="mt-2 text-center">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      stepIndex <= currentStep
                        ? "text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {step.title}
                  </p>
                  <p
                    className={cn(
                      "text-xs mt-1 hidden sm:block",
                      stepIndex <= currentStep
                        ? "text-muted-foreground"
                        : "text-muted-foreground/60",
                    )}
                  >
                    {step.description}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
};

export const MobileStepWizard = ({
  steps,
  currentStep,
}: Pick<StepWizardProps, "steps" | "currentStep">) => {
  const current = steps[currentStep];

  return (
    <div className="sm:hidden">
      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
        <div className="flex items-center space-x-3">
          <div
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-full",
              "bg-primary text-primary-foreground",
            )}
          >
            <span className="text-sm font-medium">{currentStep + 1}</span>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {current.title}
            </p>
            <p className="text-xs text-muted-foreground">
              Step {currentStep + 1} of {steps.length}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-1 text-xs text-muted-foreground">
          {currentStep + 1}/{steps.length}
        </div>
      </div>
    </div>
  );
};
