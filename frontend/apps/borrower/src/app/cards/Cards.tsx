import { useHttpClientBorrower } from "@frontend/http-client-borrower";
import { CurrencyFormatter } from "@frontend/ui-shared";
import { useState } from "react";
import { useAsync } from "react-use";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@frontend/shadcn";
import { Button } from "@frontend/shadcn";
import { Badge } from "@frontend/shadcn";
import {
  Plus,
  Eye,
  EyeOff,
  Wallet,
  Copy,
  Check,
  MoreVertical,
  DollarSign,
} from "lucide-react";
import NoCreditCard from "./../../assets/creditcard-illustration.png";
import CardHistory from "./CardHistory";
import { CardPickerModal } from "./CardPickerModal";
import { TopUpModal } from "./TopUpModal";
import { NewCardModal } from "./NewCardModal";

export default function Cards() {
  const [visible, setVisible] = useState<boolean>(false);
  const [activeCardIndex, setActiveCardIndex] = useState<number>(0);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [cardPickerOpen, setCardPickerOpen] = useState<boolean>(false);
  const [topUpModalOpen, setTopUpModalOpen] = useState<boolean>(false);
  const [newCardModalOpen, setNewCardModalOpen] = useState<boolean>(false);

  const { getUserCards } = useHttpClientBorrower();

  const {
    loading,
    value: maybeUserCardDetails,
    error,
  } = useAsync(async () => {
    return getUserCards();
  }, []);

  if (error) {
    console.error(`Failed loading card details ${error}`);
  }

  if (loading) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2"></div>
      </div>
    );
  }

  console.log(`maybeUserCardDetails: ${maybeUserCardDetails?.length}`);
  const userCardDetails = maybeUserCardDetails || [];
  const activeCard = userCardDetails[activeCardIndex];

  const formatCreditCardNumber = (pan: string) => {
    const numStr = pan.replace(/\D/g, "");
    return numStr.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  const isCardExpired = (expirationDate: string) => {
    // Parse MM/YY format
    const [month, year] = expirationDate.split("/");
    if (!month || !year) return false;

    // Convert YY to full year (assuming 20YY)
    const fullYear = 2000 + parseInt(year, 10);
    const expMonth = parseInt(month, 10);

    // Create expiration date at end of the month
    const expDate = new Date(fullYear, expMonth, 0); // Day 0 gets last day of previous month
    const today = new Date();

    return today > expDate;
  };

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto max-w-7xl space-y-8 p-6">
        {!activeCard ? (
          // No cards state
          <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
            <img
              src={NoCreditCard}
              alt="Credit Card"
              className="mb-6 h-40 w-auto opacity-80"
            />
            <h3 className="mb-2 text-xl font-semibold">No cards yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              Get started by requesting your first crypto-backed credit card
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link to="/requests">
                  <Plus className="mr-2 h-4 w-4" />
                  Get Card with Loan
                </Link>
              </Button>
              <Button
                onClick={() => setNewCardModalOpen(true)}
                variant="outline"
                size="lg"
              >
                <DollarSign className="mr-2 h-4 w-4" />
                Get Card Without Loan
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Card Display Section - Centered */}
            <div className="flex justify-center">
              <div className="w-full max-w-md space-y-6">
                {/* Card Visual */}
                <Card className="overflow-hidden">
                  <CardContent className="px-6">
                    {/* Card Header */}
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Badge
                          className={
                            isCardExpired(activeCard.expiration)
                              ? "border-red-200 bg-red-100 text-red-800"
                              : "border-green-200 bg-green-100 text-green-800"
                          }
                        >
                          {isCardExpired(activeCard.expiration)
                            ? "EXPIRED"
                            : "ACTIVE"}
                        </Badge>
                        {userCardDetails.length > 1 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCardPickerOpen(true)}
                            className="text-xs"
                          >
                            <MoreVertical className="mr-1 h-3 w-3" />
                            {userCardDetails.length} Cards
                          </Button>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setVisible(!visible)}
                      >
                        {visible ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    {/* Credit Card Visual */}
                    <div className="group relative mb-6 h-52 w-full overflow-hidden rounded-xl bg-gradient-to-br from-blue-900 to-black text-white">
                      {/* Background Pattern */}
                      <div className="absolute inset-0 opacity-10">
                        <div className="absolute right-4 top-4 h-20 w-20 rounded-full bg-white/20 transition-transform duration-700 group-hover:scale-110"></div>
                        <div className="absolute bottom-4 left-4 h-12 w-12 rounded-full bg-white/10 transition-transform duration-500 group-hover:scale-125"></div>
                      </div>

                      <div className="relative z-10 flex h-full flex-col justify-between p-6">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-xl font-semibold">
                              Lendasat Card
                            </h3>
                          </div>
                          <div className="text-2xl font-bold">VISA</div>
                        </div>

                        <div>
                          <div className="mb-3 flex items-center justify-between">
                            <div className="font-mono text-2xl tracking-wider">
                              {visible
                                ? formatCreditCardNumber(activeCard.pan)
                                : "•••• •••• •••• ••••"}
                            </div>
                            {visible && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  copyToClipboard(activeCard.pan, "cardNumber")
                                }
                                className="h-8 w-8 p-0 text-white hover:bg-white/20"
                              >
                                {copiedField === "cardNumber" ? (
                                  <Check className="h-4 w-4" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </div>
                          <div className="text-md flex justify-between opacity-90">
                            <div className="flex items-center space-x-2">
                              <span>{visible ? activeCard.cvv : "•••"}</span>
                              {visible && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    copyToClipboard(activeCard.cvv, "cvv")
                                  }
                                  className="h-6 w-6 p-0 text-white hover:bg-white/20"
                                >
                                  {copiedField === "cvv" ? (
                                    <Check className="h-3 w-3" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </Button>
                              )}
                            </div>
                            <span>
                              {visible ? activeCard.expiration : "••/••"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Balance Display */}
                    <div className="mb-6 grid grid-cols-2 gap-4">
                      <div className="bg-muted/30 rounded-lg p-4 text-center">
                        <div className="mb-2 flex items-center justify-center">
                          <Wallet className="text-muted-foreground h-4 w-4" />
                        </div>
                        <p className="text-muted-foreground mb-1 text-sm">
                          Available Balance
                        </p>
                        <p className="text-xl font-bold">
                          <CurrencyFormatter
                            value={activeCard.available_balance}
                          />
                        </p>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-4 text-center">
                        <div className="mb-2 flex items-center justify-center">
                          <Wallet className="text-muted-foreground h-4 w-4" />
                        </div>
                        <p className="text-muted-foreground mb-1 text-sm">
                          Total Balance
                        </p>
                        <p className="text-xl font-bold">
                          <CurrencyFormatter value={activeCard.balance} />
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Action Buttons */}
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    onClick={() => setTopUpModalOpen(true)}
                    className="flex-1"
                    variant="outline"
                  >
                    <DollarSign className="mr-2 h-4 w-4" />
                    Add Funds
                  </Button>
                  <Button
                    onClick={() => setNewCardModalOpen(true)}
                    className="flex-1"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Get Card Without Loan
                  </Button>
                </div>
              </div>
            </div>

            {/* Transaction History Section - Below the card */}
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="mb-1 text-2xl font-semibold">
                  Transaction History
                </h2>
                <p className="text-muted-foreground">
                  Recent activity on your card
                </p>
              </div>

              <CardHistory
                cardId={activeCard.id}
                lastFourCardDigits={activeCard.pan.substring(
                  activeCard.pan.length - 4,
                )}
              />
            </div>
          </div>
        )}

        {/* Card Picker Modal */}
        <CardPickerModal
          open={cardPickerOpen}
          onOpenChange={setCardPickerOpen}
          cards={userCardDetails}
          activeCardIndex={activeCardIndex}
          onSelectCard={setActiveCardIndex}
          isCardExpired={isCardExpired}
        />

        {/* Top Up Modal */}
        {activeCard && (
          <TopUpModal
            open={topUpModalOpen}
            onOpenChange={setTopUpModalOpen}
            cardId={activeCard.id}
            cardName="Lendasat Card"
          />
        )}

        {/* New Card Modal */}
        <NewCardModal
          open={newCardModalOpen}
          onOpenChange={setNewCardModalOpen}
        />
      </div>
    </div>
  );
}
