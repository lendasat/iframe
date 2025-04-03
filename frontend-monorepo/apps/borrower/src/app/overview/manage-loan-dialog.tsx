import React, { useState } from "react";
import {
  LuCalendarClock,
  LuCheck,
  LuCircleAlert,
  LuClipboard,
  LuExternalLink,
  LuInfo,
  LuLoader,
  LuQrCode,
} from "react-icons/lu";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@frontend/shadcn";
import {
  Contract,
  useBorrowerHttpClient,
} from "@frontend/http-client-borrower";
import { format } from "date-fns";
import {
  formatCurrency,
  getAddressUrl,
  LoanAssetHelper,
} from "@frontend/ui-shared";
import QRCode from "qrcode.react";
import { useNavigate } from "react-router-dom";
import { Repayment } from "./manage-loan-dialig/repayment";

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
  const [activeTab, setActiveTab] = useState("repay");
  const [extensionMonths, setExtensionMonths] = useState<string>("1");

  const contractId = contract?.id;

  const currentExpiryDate = contract?.expiry;

  const onRequestExtension = (months: number) => {
    // do nothing
  };

  // Format date
  const formatDate = (date?: Date) => {
    if (!date) return "Unknown";
    return format(date, "MMM, do yyyy - p");
  };

  // Calculate new expiry date
  const calculateNewExpiryDate = () => {
    if (!currentExpiryDate) return "Unknown";

    const newDate = new Date(currentExpiryDate);
    newDate.setMonth(newDate.getMonth() + parseInt(extensionMonths));

    return formatDate(newDate);
  };

  // Handle extension request
  const handleExtensionRequest = () => {
    if (onRequestExtension) {
      onRequestExtension(parseInt(extensionMonths));
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Loan</DialogTitle>
          <DialogDescription>
            Contract ID: {shortenUuid(contractId)}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="repay" onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="repay">Repay Loan</TabsTrigger>
            <TabsTrigger value="extend">Request Extension</TabsTrigger>
          </TabsList>

          <TabsContent value="repay" className="space-y-4 py-4">
            <Repayment contract={contract} />
          </TabsContent>

          <TabsContent value="extend" className="space-y-4 py-4">
            <div className="space-y-2">
              <div>
                <Label>Current Expiry Date</Label>
                <p className="text-lg font-bold">
                  {formatDate(currentExpiryDate)}
                </p>
              </div>

              <Alert className="my-4">
                <LuCalendarClock className="h-4 w-4" />
                <AlertTitle>Request Extension</AlertTitle>
                <AlertDescription>
                  You can request to extend your loan term. The lender will need
                  to approve this request, and an extension fee may apply.
                </AlertDescription>
              </Alert>

              <div className="pt-2">
                <Label htmlFor="extension-period" className="block mb-2">
                  Extension Period
                </Label>
                <RadioGroup
                  id="extension-period"
                  value={extensionMonths}
                  onValueChange={setExtensionMonths}
                  className="flex flex-col space-y-1"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="1" id="r1" />
                    <Label htmlFor="r1">1 Month</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="3" id="r2" />
                    <Label htmlFor="r2">3 Months</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="6" id="r3" />
                    <Label htmlFor="r3">6 Months</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="pt-4">
                <Label>New Expiry Date (if approved)</Label>
                <p className="text-lg font-bold">{calculateNewExpiryDate()}</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex sm:justify-between gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Back
          </Button>

          {/*<Button variant="default" onClick={handleExtensionRequest}>*/}
          {/*  Request Extension*/}
          {/*</Button>*/}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManageLoanDialog;
