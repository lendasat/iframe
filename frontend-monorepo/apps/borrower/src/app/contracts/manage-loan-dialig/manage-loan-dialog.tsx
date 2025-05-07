import React, { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@frontend/shadcn";
import { Contract } from "@frontend/http-client-borrower";
import { Repayment } from "./repayment";
import { ExtendContract } from "./extend";

const shortenUuid = (uuid?: string) => {
  if (!uuid) {
    return undefined;
  }
  const firstSix = uuid.slice(0, 6);
  const lastFour = uuid.slice(-4);

  return `${firstSix}...${lastFour}`;
};

interface ManageLoanDialogProps {
  children: React.ReactNode;
  contract?: Contract;
}

const ManageLoanDialog = ({ children, contract }: ManageLoanDialogProps) => {
  const [open, setOpen] = useState(false);

  const contractId = contract?.id;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Loan</DialogTitle>
          <DialogDescription>
            Contract ID: {shortenUuid(contractId)}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="repay">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="repay">Repay Loan</TabsTrigger>
            <TabsTrigger value="extend">Request Extension</TabsTrigger>
          </TabsList>

          <TabsContent value="repay" className="space-y-4 py-4">
            <Repayment contract={contract} />
          </TabsContent>

          <TabsContent value="extend" className="space-y-4 py-4">
            <ExtendContract
              contract={contract}
              onSumbitted={() => setOpen(false)}
            />
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex sm:justify-between gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Back
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManageLoanDialog;
