import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Bitcoin } from 'lucide-react';
import { Badge } from './components/ui/badge';

const CheckoutPage = () => {
  return (
    <div className="max-w-6xl mx-auto p-4 font-sans">
      <h1 className="text-2xl font-bold mb-6">Order Summary</h1>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Column - Products and Shipping */}
        <div className="flex-1">
          {/* Product Items */}
          <div className="space-y-4 mb-6">
            <div className="flex items-center justify-between py-4 border-b">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gray-200 rounded">
                  <img src="/watch.png" alt="Premium Watch" className="w-full h-full object-cover" />
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

            <div className="flex items-center justify-between py-4 border-b">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gray-200 rounded">
                  <img src="/headphones.png" alt="Wireless Headphones" className="w-full h-full object-cover" />
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
          <div className="space-y-2 mb-8">
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
            <div className="flex justify-between pt-2 border-t font-bold">
              <p>Total</p>
              <p>$496.83</p>
            </div>
          </div>

          {/* Shipping Address */}
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">Shipping</h2>
            <Card>
              <CardContent className="p-4">
                <div>
                  <p className="font-bold">Sarah Johnson</p>
                  <p>123 Main Street</p>
                  <p>San Francisco, CA 94105</p>
                  <p>sarah@example.com</p>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>

        {/* Right Column - Payment Methods */}
        <div className="lg:w-1/2">
          <section>
            <h2 className="text-xl font-bold mb-4">Payment Method</h2>
            <RadioGroup defaultValue="bitcoin">
              <div className="border rounded-lg mb-4 p-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="standard" id="standard" />
                  <Label htmlFor="standard" className="font-bold">Standard Payment</Label>
                </div>
                <div className="mt-2 ml-6">
                  <p className="text-gray-700 mb-4">Pay the full amount now using standard payment methods.</p>
                  <div className="flex gap-2">
                    <div className="p-2 rounded w-12 h-8 flex items-center justify-center">
                      <Badge>CARD</Badge>
                    </div>
                    <div className="p-2 rounded w-12 h-8 flex items-center justify-center">
                      <Badge>Visa</Badge>
                    </div>
                    <div className="p-2 rounded w-12 h-8 flex items-center justify-center">
                      <Badge>MasterCard</Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4 bg-orange-50 border-orange-200">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="bitcoin" id="bitcoin" />
                  <Label htmlFor="bitcoin" className="font-bold flex items-center">
                    <Bitcoin className="w-5 h-5 mr-2 text-orange-500" />
                    Bitcoin-Backed Loan
                  </Label>
                </div>
                <div className="mt-2 ml-6">
                  <p className="text-gray-700 mb-4">Use your Bitcoin as collateral to finance your purchase without selling. No credit check required.</p>
                  <div className="flex justify-between items-center">
                    <p className="font-medium">Order Total:</p>
                    <p className="font-bold">496.83</p>
                  </div>
                  <div className="flex justify-between mt-4">
                    <Button variant="link" className="text-blue-600 p-0">How does it work?</Button>
                    <Button className="bg-orange-500 hover:bg-orange-600 flex items-center gap-2">
                      <Bitcoin className="w-4 h-4" />
                      Pay with Bitcoin Loan
                    </Button>
                  </div>
                </div>
              </div>
            </RadioGroup>
          </section>

          {/* Complete Purchase Button */}
          <Button className="w-full py-6 text-lg bg-green-600 hover:bg-green-700 mt-8">
            <span className="mr-2">🔒</span> Complete Purchase
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
