import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@frontend/shadcn";
import { Button } from "@frontend/shadcn";
import { Badge } from "@frontend/shadcn";
import { Card } from "@frontend/shadcn";
import { Check } from "lucide-react";
import { cn } from "@frontend/shadcn";
import { CurrencyFormatter } from "@frontend/ui-shared";
import type { UserCardDetail } from "@frontend/http-client-borrower";

interface CardPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cards: UserCardDetail[];
  activeCardIndex: number;
  onSelectCard: (cardIndex: number) => void;
  isCardExpired: (expirationDate: string) => boolean;
}

export function CardPickerModal({
  open,
  onOpenChange,
  cards,
  activeCardIndex,
  onSelectCard,
  isCardExpired,
}: CardPickerModalProps) {
  const getStatusColor = (card: UserCardDetail) => {
    if (isCardExpired(card.expiration)) {
      return "border-red-200 bg-red-100 text-red-800";
    }
    return "border-green-200 bg-green-100 text-green-800";
  };

  const getStatusText = (card: UserCardDetail) => {
    if (isCardExpired(card.expiration)) {
      return "EXPIRED";
    }
    return "ACTIVE";
  };

  const handleSelectCard = (cardIndex: number) => {
    onSelectCard(cardIndex);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Select Card
          </DialogTitle>
          <p className="text-muted-foreground">Choose which card to display</p>
        </DialogHeader>

        <div className="space-y-3">
          {cards.map((card, index) => {
            const isSelected = index === activeCardIndex;

            return (
              <Card
                key={card.id}
                className={cn(
                  "p-4 cursor-pointer transition-colors hover:bg-secondary/50",
                  isSelected && "ring-2 ring-primary",
                )}
                onClick={() => handleSelectCard(index)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-12 h-8 bg-gradient-to-br from-blue-900 to-black rounded-md flex items-center justify-center">
                        <span className="text-xs font-bold text-white">
                          VISA
                        </span>
                      </div>
                      <div>
                        <h4 className="font-semibold">Lendasat Card</h4>
                        <p className="text-sm text-muted-foreground">
                          •••• {card.pan.slice(-4)}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="ml-auto">
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                            <Check className="h-3 w-3 text-primary-foreground" />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <Badge className={getStatusColor(card)}>
                        {getStatusText(card)}
                      </Badge>
                      <div className="text-right">
                        <p className="font-semibold">
                          <CurrencyFormatter value={card.available_balance} />
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Available
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
