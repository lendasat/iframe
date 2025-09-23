import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Input,
  Button,
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  DialogFooter,
} from "@frontend/shadcn";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LoanApplication } from "@frontend/http-client-borrower";

const loanApplicationSchema = z.object({
  loan_amount_min: z
    .number({ coerce: true })
    .int("Amount must be an integer")
    .min(10, "Amount must be greater than $10"),
  loan_amount_max: z
    .number({ coerce: true })
    .int("Amount must be an integer")
    .min(10, "Amount must be greater than $10"),
  duration_days_min: z
    .number({ coerce: true })
    .int("Duration must be an integer")
    .positive("Duration must be greater than 7 days"),
  duration_days_max: z
    .number({ coerce: true })
    .int("Duration must be an integer")
    .positive("Duration must be greater than 7 days"),
  interest_rate: z
    .number({ coerce: true })
    .min(0, "Interest rate must be non-negative")
    .max(100, "Interest rate must not exceed 100%"),
  ltv: z
    .number({ coerce: true })
    .min(1, "LTV must be greater than 1%")
    .max(70, "LTV must not exceed 70%"),
});

interface EditLoanApplicationDialogProps {
  isDialogOpen: boolean;
  handleDialogClose: () => void;
  currentLoanApplication: LoanApplication;
  onSubmit: (
    loan_amount_min: number,
    loan_amount_max: number,
    duration_days_min: number,
    duration_days_max: number,
    interest_rate: number,
    ltv: number,
  ) => Promise<void>;
}

function EditLoanApplicationDialog({
  isDialogOpen,
  handleDialogClose,
  currentLoanApplication,
  onSubmit,
}: EditLoanApplicationDialogProps) {
  const startingValues = {
    loan_amount_min: currentLoanApplication.loan_amount_min,
    loan_amount_max: currentLoanApplication.loan_amount_max,
    duration_days_min: currentLoanApplication.duration_days_min,
    duration_days_max: currentLoanApplication.duration_days_max,
    interest_rate: parseFloat(
      (currentLoanApplication.interest_rate * 100).toFixed(3),
    ),
    ltv: parseFloat((currentLoanApplication.ltv * 100).toFixed(2)),
  };

  const form = useForm<z.infer<typeof loanApplicationSchema>>({
    resolver: zodResolver(loanApplicationSchema),
    values: startingValues,
  });

  const onSubmitForm = async (
    values: z.infer<typeof loanApplicationSchema>,
  ) => {
    await onSubmit(
      values.loan_amount_min,
      values.loan_amount_max,
      values.duration_days_min,
      values.duration_days_max,
      parseFloat((values.interest_rate / 100).toFixed(3)),
      parseFloat((values.ltv / 100).toFixed(2)),
    );
    handleDialogClose();
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit loan request</DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            Update the terms of your loan request.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmitForm)}>
            <div className="grid gap-4 py-4">
              <div className="space-y-4">
                <FormLabel>Loan Amount Range ($)</FormLabel>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="loan_amount_min"
                    render={({ field }) => {
                      return (
                        <FormItem>
                          <FormLabel className="text-xs">Minimum</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                  <FormField
                    control={form.control}
                    name="loan_amount_max"
                    render={({ field }) => {
                      return (
                        <FormItem>
                          <FormLabel className="text-xs">Maximum</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                </div>
              </div>
              <div className="space-y-4">
                <FormLabel>Duration Range (days)</FormLabel>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="duration_days_min"
                    render={({ field }) => {
                      return (
                        <FormItem>
                          <FormLabel className="text-xs">Minimum</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                  <FormField
                    control={form.control}
                    name="duration_days_max"
                    render={({ field }) => {
                      return (
                        <FormItem>
                          <FormLabel className="text-xs">Maximum</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                </div>
              </div>
              <FormField
                control={form.control}
                name="interest_rate"
                render={({ field }) => {
                  return (
                    <FormItem>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <FormLabel>Yearly interest rate (%)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            className="col-span-3"
                            {...field}
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              <FormField
                control={form.control}
                name="ltv"
                render={({ field }) => {
                  return (
                    <FormItem>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <FormLabel>LTV (%)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            className="col-span-3"
                            {...field}
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>

            <DialogFooter>
              <Button
                type="submit"
                className="hover:bg-gray-600 text-white"
                onClick={() => {
                  form.handleSubmit(onSubmitForm);
                }}
              >
                Submit
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default EditLoanApplicationDialog;
