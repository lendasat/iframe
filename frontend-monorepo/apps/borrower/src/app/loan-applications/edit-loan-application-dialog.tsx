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
  loan_amount: z
    .number({ coerce: true })
    .int("Amount must be an integer")
    .min(10, "Amount must be greater than $10"),
  duration_days: z
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
    loan_amount: number,
    duration_days: number,
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
    loan_amount: currentLoanApplication.loan_amount,
    duration_days: currentLoanApplication.duration_days,
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
      values.loan_amount,
      values.duration_days,
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
              <FormField
                control={form.control}
                name="loan_amount"
                render={({ field }) => {
                  return (
                    <FormItem>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <FormLabel>Loan amount ($)</FormLabel>
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
                name="duration_days"
                render={({ field }) => {
                  return (
                    <FormItem>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <FormLabel>Duration (days)</FormLabel>
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
