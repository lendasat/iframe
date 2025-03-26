import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator.tsx";
import {
  DataList,
  DataListItem,
  DataListLabel,
  DataListValue,
} from "./components/ui/data-list";
import { Badge } from "./components/ui/badge";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Input } from "./components/ui/input";

interface LoanTermsProps {
  loanAmount: number;
  months: number;
  yearlyInterestRate: number;
  ltvRatio: number;
}

const LoanTerms = ({
  loanAmount,
  months,
  yearlyInterestRate,
  ltvRatio,
}: LoanTermsProps) => {
  const [loading, setLoading] = React.useState(false);

  const loanAmountString = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(loanAmount);

  // Sample loan data
  const loanData = {
    id: "#123456789",
    status: "Waiting for transaction",
    loanAmount: `\$${loanAmountString}`,
    bitcoinCollateral: "₿ 0.13 370 000",
    interestRate: `${yearlyInterestRate}% p.a.`,
    loanDuration: `${months} months`,
    loanToValueRatio: `${ltvRatio}%`,
  };

  const handleDownload = () => {
    setLoading(true);
    // Simulate download delay
    setTimeout(() => {
      setLoading(false);
      console.log("Contract details downloaded");
    }, 2000);
  };

  // TODO: Move ID to different place.
  const contractAddress =
    "tb1ps4wx9znwf972hqp9m6fz9cw807d3gcw42xegzqfclfgn8nr3ppks5ge5xt";
  return (
    <div className="mx-auto max-w-md">
      <Card className="gap-3 p-4">
        <CardHeader>
          <CardTitle>Loan Summary</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col">
          <DataList orientation="horizontal" className="gap-4">
            <DataListItem>
              <DataListLabel className="w-32">Status</DataListLabel>
              <DataListValue>
                <Badge variant={"success"}>{loanData.status}</Badge>
              </DataListValue>
            </DataListItem>

            <DataListItem>
              <DataListLabel className="w-32">ID</DataListLabel>
              <DataListValue className="flex items-center gap-2">
                {loanData.id}
                <Button variant="outline" size="icon">
                  <Copy />
                </Button>
              </DataListValue>
            </DataListItem>

            <DataListItem>
              <DataListLabel className="w-32">Loan amount</DataListLabel>
              <DataListValue>{loanData.loanAmount}</DataListValue>
            </DataListItem>

            <DataListItem>
              <DataListLabel className="w-32">Collateral amount</DataListLabel>
              <DataListValue>{loanData.bitcoinCollateral}</DataListValue>
            </DataListItem>

            <DataListItem>
              <DataListLabel className="w-32">Interest rate</DataListLabel>
              <DataListValue>{loanData.interestRate}</DataListValue>
            </DataListItem>

            <DataListItem>
              <DataListLabel className="w-32">Loan duration</DataListLabel>
              <DataListValue>{loanData.loanDuration}</DataListValue>
            </DataListItem>

            <DataListItem>
              <DataListLabel className="w-32">LTV ratio</DataListLabel>
              <DataListValue>{loanData.loanToValueRatio}</DataListValue>
            </DataListItem>
          </DataList>

          <Separator className="my-4 border-gray-600" />

          <div className="my-8 flex w-full max-w-md flex-col items-center justify-center">
            <QRCodeSVG value={contractAddress} size={200} />

            <div className="flex w-full items-center space-x-2 pt-4">
              <Input
                id="link"
                defaultValue={contractAddress}
                readOnly
                className="flex-1"
              />
              <Button
                size="sm"
                className="px-3"
                onClick={() => {
                  navigator.clipboard.writeText(contractAddress);
                  // Optional: Add toast notification here
                  toast.success("Copied address to clipboard");
                }}
              >
                <span className="sr-only">Copy</span>
                <Copy />
              </Button>
            </div>
          </div>

          <Button
            variant="outline"
            className="mt-4 w-full"
            onClick={handleDownload}
            disabled={loading}
          >
            {loading && <Loader2 className="animate-spin" />}
            Download contract details
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoanTerms;
