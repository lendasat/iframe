import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Bitcoin } from "lucide-react";
import { Badge } from "./components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion.tsx";

const CheckoutPage = () => {
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

          {/* Shipping Address */}
          {/*<section className="mb-8">*/}
          {/*  <h2 className="mb-4 text-xl font-bold">Shipping</h2>*/}
          {/*  <Card>*/}
          {/*    <CardContent className="p-4">*/}
          {/*      <div>*/}
          {/*        <p className="font-bold">Sarah Johnson</p>*/}
          {/*        <p>123 Main Street</p>*/}
          {/*        <p>San Francisco, CA 94105</p>*/}
          {/*        <p>sarah@example.com</p>*/}
          {/*      </div>*/}
          {/*    </CardContent>*/}
          {/*  </Card>*/}
          {/*</section>*/}
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
                        <Button className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600">
                          <Bitcoin className="h-4 w-4" />
                          Pay with Bitcoin Loan
                        </Button>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </div>
            </Accordion>
          </section>
          {/*<section>
            <h2 className="mb-4 text-xl font-bold">Payment Method</h2>
            <RadioGroup defaultValue="bitcoin">
              <div className="mb-4 rounded-lg border p-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="standard" id="standard" />
                  <Label htmlFor="standard" className="font-bold">
                    Standard Payment
                  </Label>
                </div>
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
              </div>

              <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="bitcoin" id="bitcoin" />
                  <Label
                    htmlFor="bitcoin"
                    className="flex items-center font-bold"
                  >
                    <Bitcoin className="mr-2 h-5 w-5 text-orange-500" />
                    Bitcoin-Backed Loan
                  </Label>
                </div>
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
                    <Button className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600">
                      <Bitcoin className="h-4 w-4" />
                      Pay with Bitcoin Loan
                    </Button>
                  </div>
                </div>
              </div>
            </RadioGroup>
          </section>*/}

          {/* Complete Purchase Button */}
          <Button className="mt-8 w-full bg-green-600 py-6 text-lg hover:bg-green-700">
            <span className="mr-2">🔒</span> Complete Purchase
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
