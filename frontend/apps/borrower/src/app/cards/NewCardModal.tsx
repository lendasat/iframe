import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@frontend/shadcn";
import { Button } from "@frontend/shadcn";
import { Input } from "@frontend/shadcn";
import { Label } from "@frontend/shadcn";
import { Separator } from "@frontend/shadcn";
import { Badge } from "@frontend/shadcn";
import { Bitcoin, DollarSign, Coins, Copy, Check, Clock } from "lucide-react";
import { useState, useEffect } from "react";
import {
  useHttpClientBorrower,
  Currency,
  NewCardResponse,
} from "@frontend/http-client-borrower";
import { QRCodeSVG } from "qrcode.react";

interface NewCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type PaymentMethod = "usdc" | "bitcoin" | "usdt";

const paymentMethods = [
  {
    id: "usdc" as PaymentMethod,
    name: "USDC",
    network: "Polygon",
    icon: DollarSign,
    description: "USD Coin on Polygon",
    currency: Currency.UsdcPolygon,
  },
  {
    id: "bitcoin" as PaymentMethod,
    name: "Bitcoin",
    network: "Bitcoin",
    icon: Bitcoin,
    description: "Bitcoin Onchain",
    currency: Currency.BtcBitcoin,
  },
  {
    id: "usdt" as PaymentMethod,
    name: "USDT",
    network: "Tron",
    icon: Coins,
    description: "Tether on Tron",
    currency: Currency.UsdtTron,
  },
];

export function NewCardModal({ open, onOpenChange }: NewCardModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("usdc");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoiceData, setInvoiceData] = useState<NewCardResponse>();
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  const { newCard } = useHttpClientBorrower();

  // Countdown timer effect
  useEffect(() => {
    if (!invoiceData?.expires_at) return;

    const updateCountdown = () => {
      const expiresAt = new Date(invoiceData.expires_at);
      const now = new Date();
      const diff = expiresAt.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining("Expired");
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, "0")}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [invoiceData]);

  const copyAddress = async () => {
    if (invoiceData?.address) {
      try {
        await navigator.clipboard.writeText(invoiceData.address);
        setCopiedAddress(true);
        setTimeout(() => setCopiedAddress(false), 2000);
      } catch (err) {
        console.error("Failed to copy address:", err);
      }
    }
  };

  const handleCreateCard = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount to fund your new card.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const selectedPaymentMethod = paymentMethods.find(
        (method) => method.id === selectedMethod,
      )!;

      const response = await newCard({
        currency: selectedPaymentMethod.currency,
        amount_usd: parseFloat(amount),
      });

      setInvoiceData(response);
      // Keep modal open to show invoice details
    } catch (err) {
      console.error(`Failed to create new card ${err}`);
      setError("Failed to initiate card creation. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state when closing
    setTimeout(() => {
      setAmount("");
      setError(null);
      setInvoiceData(undefined);
      setSelectedMethod("usdc");
      setCopiedAddress(false);
      setTimeRemaining("");
    }, 200);
  };

  const selectedPaymentMethod = paymentMethods.find(
    (method) => method.id === selectedMethod,
  )!;

  // Show invoice details if card creation was successful
  if (invoiceData) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="flex max-h-[90vh] max-w-lg flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              Payment Instructions
            </DialogTitle>
            <p className="text-muted-foreground">
              Send payment to complete your new card creation
            </p>
          </DialogHeader>

          <div className="flex-1 space-y-6 overflow-y-auto pr-2">
            {/* QR Code */}
            <div className="flex justify-center">
              <div className="rounded-lg border bg-white p-4">
                <QRCodeSVG
                  value={invoiceData.address}
                  size={200}
                  level="H"
                  includeMargin={false}
                />
              </div>
            </div>

            <div className="bg-secondary/50 rounded-lg border p-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Amount ({selectedPaymentMethod.name})
                  </span>
                  <span className="font-semibold">
                    {invoiceData.crypto_amount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Network</span>
                  <span>{selectedPaymentMethod.network}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Send to address:
                  </span>
                </div>
                <div className="relative">
                  <div className="bg-background break-all rounded border p-2 pr-10 font-mono text-sm">
                    {invoiceData.address}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyAddress}
                    className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 p-0"
                  >
                    {copiedAddress ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Expires in:
                  </span>
                  <span
                    className={`font-mono font-semibold ${
                      timeRemaining === "Expired" ? "text-red-600" : ""
                    }`}
                  >
                    {timeRemaining}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-sm text-blue-800">
                <strong>Important:</strong> Send exactly{" "}
                {invoiceData.crypto_amount} {selectedPaymentMethod.name} to the
                address above. Once payment is confirmed, your new card will be
                created and activated automatically. This page will not be
                updated automatically. We will send an email once your card is
                ready.
              </p>
            </div>

            <Button onClick={handleClose} className="w-full">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[90vh] max-w-md flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Create New Card
          </DialogTitle>
          <p className="text-muted-foreground">
            Fund your new Lendasat Card without taking a loan
          </p>
        </DialogHeader>

        <div className="flex-1 space-y-6 overflow-y-auto pr-2">
          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="amount">Initial Amount (USD)</Label>
            <div className="relative">
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-8 text-lg font-semibold"
                min="1"
                max="5000"
                step="0.01"
              />
              <DollarSign className="text-muted-foreground absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 transform" />
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
          </div>

          <Separator />

          {/* Payment Methods */}
          <div className="space-y-3">
            <Label>Select Payment Method</Label>
            <div className="space-y-2">
              {paymentMethods.map((method) => {
                const Icon = method.icon;
                const isSelected = method.id === selectedMethod;

                return (
                  <div
                    key={method.id}
                    onClick={() => setSelectedMethod(method.id)}
                    className={`hover:bg-secondary/50 cursor-pointer rounded-lg border p-4 transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div
                          className={`rounded-lg p-2 ${
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{method.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {method.network}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground text-sm">
                            {method.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary */}
          {amount && parseFloat(amount) > 0 && (
            <div className="bg-secondary/50 rounded-lg border p-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Initial Amount</span>
                  <span>${parseFloat(amount || "0").toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Network</span>
                  <span>{selectedPaymentMethod.network}</span>
                </div>
              </div>
            </div>
          )}

          {/* Terms Statement */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="text-sm text-blue-800">
              By creating a card, you accept our{" "}
              <a
                href="https://tos.lendasat.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-blue-900"
              >
                Lendasat Terms & Conditions
              </a>
              {" and "}
              <a
                href="https://paywithmoon.com/terms-conditions"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-blue-900"
              >
                Moon Terms & Conditions
              </a>
              .
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex-1"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCard}
              className="flex-1"
              disabled={loading || !amount || parseFloat(amount) <= 0}
            >
              {loading ? "Processing..." : "Create Card"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
