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

const LoanTerms = () => {
  const [loading, setLoading] = React.useState(false);

  // Sample loan data
  const loanData = {
    id: "#123456789",
    status: "Waiting for transactions",
    loanAmount: "$5,000",
    bitcoinCollateral: "0.13 370 000 BTC",
    interestRate: "13% p.a.",
    loanDuration: "6 months",
    loanToValueRatio: "50%",
  };

  const handleDownload = () => {
    setLoading(true);
    // Simulate download delay
    setTimeout(() => {
      setLoading(false);
      console.log("Contract details downloaded");
    }, 2000);
  };

  return (
    <div className="mx-auto max-w-md p-4">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Loan Summary</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center">
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
              <DataListLabel className="w-32">Bitcoin Collateral</DataListLabel>
              <DataListValue>{loanData.bitcoinCollateral}</DataListValue>
            </DataListItem>

            <DataListItem>
              <DataListLabel className="w-32">Interest Rate</DataListLabel>
              <DataListValue>{loanData.interestRate}</DataListValue>
            </DataListItem>

            <DataListItem>
              <DataListLabel className="w-32">Loan Duration</DataListLabel>
              <DataListValue>{loanData.loanDuration}</DataListValue>
            </DataListItem>

            <DataListItem>
              <DataListLabel className="w-32">
                Loan-to-Value ratio
              </DataListLabel>
              <DataListValue>{loanData.loanToValueRatio}</DataListValue>
            </DataListItem>
          </DataList>

          <Separator className={"m-4"} />

          <div className="my-8 flex justify-center">
            <img
              src="/api/placeholder/200/200"
              alt="QR Code"
              className="h-40 w-40"
            />
          </div>

          <Button
            variant="outline"
            className="mt-4 w-full"
            onClick={handleDownload}
            disabled={loading}
          >
            {loading && <Loader2 className="animate-spin" />}
            Download Contract Details
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoanTerms;
