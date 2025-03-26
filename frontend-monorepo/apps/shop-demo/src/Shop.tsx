import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Bitcoin, Mail } from "lucide-react";
import { Badge } from "./components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion.tsx";
import { useState } from "react";
import { LendasatButton } from "@frontend/lendasat-button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input.tsx";

const CheckoutPage = () => {
  const [success, setSuccess] = useState(false);

  const handlePaymentSuccess = (data: {
    transactionId?: string;
    amount?: number;
    [key: string]: any;
  }) => {
    console.log("Payment successful!", data);
    // Update UI or state based on successful payment
    setSuccess(true);
  };

  const handlePaymentCancel = (data?: {
    reason?: string;
    [key: string]: any;
  }) => {
    console.log("Payment cancelled", data?.reason);
    // Handle cancellation
  };

  const handlePaymentError = (error: {
    error: string;
    message: string;
    [key: string]: any;
  }) => {
    console.error("Payment error:", error.message);
    // Display error message to user
  };

  return (
    <div className="mx-auto max-w-6xl p-4 font-sans">
      <h1 className="mb-6 text-2xl font-bold">Order Summary</h1>

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Left Column - Products and Shipping */}
        <div className="flex-1">
          {/* Product Items */}
          <div className="mb-6 space-y-4">
            <div className="flex items-center justify-between border-b py-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded bg-gray-200">
                  <img
                    src="/watch.png"
                    alt="Premium Watch"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div>
                  <h3 className="font-medium">Premium Watch</h3>
                  <p className="text-gray-600">Black / 42mm</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium">$299.00</p>
                <p className="text-gray-600">Qty: 1</p>
              </div>
            </div>

            <div className="flex items-center justify-between border-b py-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded bg-gray-200">
                  <img
                    src="/headphones.png"
                    alt="Wireless Headphones"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div>
                  <h3 className="font-medium">Wireless Headphones</h3>
                  <p className="text-gray-600">Black</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium">$149.00</p>
                <p className="text-gray-600">Qty: 1</p>
              </div>
            </div>
          </div>

          {/* Order Totals */}
          <div className="mb-8 space-y-2">
            <div className="flex justify-between">
              <p>Subtotal</p>
              <p className="font-medium">$448.00</p>
            </div>
            <div className="flex justify-between">
              <p>Shipping</p>
              <p className="font-medium">$12.99</p>
            </div>
            <div className="flex justify-between">
              <p>Tax</p>
              <p className="font-medium">$35.84</p>
            </div>
            <div className="flex justify-between border-t pt-2 font-bold">
              <p>Total</p>
              <p>$496.83</p>
            </div>
          </div>
        </div>

        {/* Right Column - Payment Methods */}
        <div className="lg:w-1/2">
          <section>
            <h2 className="mb-4 text-xl font-bold">Payment Method</h2>
            <Accordion type="multiple" defaultValue={["item-2"]}>
              <div className="mb-4 rounded-lg border p-4">
                <AccordionItem value="item-1">
                  <AccordionTrigger>
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="standard" className="font-bold">
                        Standard Payment
                      </Label>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="ml-6 mt-2">
                      <p className="mb-4 text-gray-700">
                        Pay the full amount now using standard payment methods.
                      </p>
                      <div className="flex gap-2">
                        <div className="flex h-8 w-12 items-center justify-center rounded p-2">
                          <Badge>CARD</Badge>
                        </div>
                        <div className="flex h-8 w-12 items-center justify-center rounded p-2">
                          <Badge>Visa</Badge>
                        </div>
                        <div className="flex h-8 w-12 items-center justify-center rounded p-2">
                          <Badge>MasterCard</Badge>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </div>
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                <AccordionItem value="item-2">
                  <AccordionTrigger>
                    <div className="flex items-center space-x-2">
                      <Label
                        htmlFor="bitcoin"
                        className="flex items-center font-bold"
                      >
                        <Bitcoin className="mr-2 h-5 w-5 text-orange-500" />
                        Bitcoin-Backed Loan
                      </Label>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="ml-6 mt-2">
                      <p className="mb-4 text-gray-700">
                        Use your Bitcoin as collateral to finance your purchase
                        without selling. No credit check required.
                      </p>
                      <div className="flex items-center justify-between">
                        <p className="font-medium">Order Total:</p>
                        <p className="font-bold">496.83</p>
                      </div>
                      <div className="mt-4 flex justify-between">
                        <Button variant="link" className="p-0 text-blue-600">
                          How does it work?
                        </Button>

                        <LendasatButton
                          amount={496.83}
                          currency="USD"
                          widgetName="Bitcoin-backed loans"
                          onSuccess={handlePaymentSuccess}
                          onCancel={handlePaymentCancel}
                          onError={handlePaymentError}
                          disabled={success}
                          aria-label="Complete checkout with Bitcoin loan"
                          buttonText="Finance with Bitcoin"
                          buttonStyle={{
                            backgroundColor: "#f7931a",
                            borderRadius: "8px",
                            padding: "12px 24px",
                            color: "white",
                          }}
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </div>
            </Accordion>
          </section>

          <Dialog>
            <DialogTrigger asChild>
              <Button
                className="mt-6 flex w-full cursor-pointer items-center justify-center rounded-md py-2 text-lg font-medium text-white h-12"
                variant="default"
                disabled={!success}
              >
                <span className="mr-2">🔒</span> Complete Purchase
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Thank you for playing</DialogTitle>
                <DialogDescription>
                  If you would like to see this widget in your webshop, please
                  send us an email to:
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center space-x-2">
                <div className="grid flex-1 gap-2">
                  <Label htmlFor="link" className="sr-only">
                    Email
                  </Label>
                  <Input id="link" defaultValue="hello@lendasat.com" readOnly />
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="px-3"
                  onClick={() =>
                    (window.location.href = "mailto:hello@lendasat.com")
                  }
                >
                  <span className="sr-only">Email us</span>
                  <Mail />
                </Button>
              </div>
              <DialogFooter className="sm:justify-start">
                <DialogClose asChild>
                  <Button variant="secondary" className="font-medium">
                    Close
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
