import React, { useState } from "react";
import { useShop } from "./ShopContext";
import { createOrder } from "./apiService";
import { Address, CreateOrderRequest, OrderItemRequest } from "./types";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const Checkout: React.FC = () => {
  const { basket, getBasketTotal, clearBasket } = useShop();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [shippingAddress, setShippingAddress] = useState<Address>({
    street: "",
    city: "",
    state: "",
    postal_code: "",
    country: "",
  });
  const [billingAddress, setBillingAddress] = useState<Address>({
    street: "",
    city: "",
    state: "",
    postal_code: "",
    country: "",
  });
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  if (basket.length === 0) {
    return (
      <div className="text-center py-8">
        <p>Your cart is empty. Add some items before checking out.</p>
        <Button
          className="mt-4"
          variant="outline"
          onClick={() => navigate("/")}
        >
          Return to Shop
        </Button>
      </div>
    );
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!customerName.trim()) newErrors.customerName = "Name is required";
    if (!customerEmail.trim()) {
      newErrors.customerEmail = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(customerEmail)) {
      newErrors.customerEmail = "Email is invalid";
    }

    // Validate shipping address
    if (!shippingAddress.street.trim())
      newErrors.shippingStreet = "Street is required";
    if (!shippingAddress.city.trim())
      newErrors.shippingCity = "City is required";
    if (!shippingAddress.state.trim())
      newErrors.shippingState = "State is required";
    if (!shippingAddress.postal_code.trim())
      newErrors.shippingPostalCode = "Postal code is required";
    if (!shippingAddress.country.trim())
      newErrors.shippingCountry = "Country is required";

    // Validate billing address if not same as shipping
    if (!sameAsBilling) {
      if (!billingAddress.street.trim())
        newErrors.billingStreet = "Street is required";
      if (!billingAddress.city.trim())
        newErrors.billingCity = "City is required";
      if (!billingAddress.state.trim())
        newErrors.billingState = "State is required";
      if (!billingAddress.postal_code.trim())
        newErrors.billingPostalCode = "Postal code is required";
      if (!billingAddress.country.trim())
        newErrors.billingCountry = "Country is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const orderItems: OrderItemRequest[] = basket.map((item) => ({
        item_id: item.id,
        quantity: item.quantity,
      }));

      const orderData: CreateOrderRequest = {
        items: orderItems,
        customer_name: customerName,
        customer_email: customerEmail,
        shipping_address: shippingAddress,
        billing_address: sameAsBilling ? shippingAddress : billingAddress,
      };

      const response = await createOrder(orderData);
      clearBasket();
      toast("Order Placed!", {
        description: "Your order has been successfully placed.",
      });
      navigate(`/order/${response.id}`);
    } catch (error) {
      console.error("Error creating order:", error);
      setErrors({
        submit: "Failed to create order. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShippingAddressChange = (field: keyof Address, value: string) => {
    setShippingAddress((prev) => ({ ...prev, [field]: value }));

    // If same as billing is checked, update billing address too
    if (sameAsBilling) {
      setBillingAddress((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleBillingAddressChange = (field: keyof Address, value: string) => {
    setBillingAddress((prev) => ({ ...prev, [field]: value }));
  };

  const handleSameAsBillingChange = (checked: boolean) => {
    setSameAsBilling(checked);
    if (checked) {
      setBillingAddress(shippingAddress);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Checkout</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <form onSubmit={handleSubmit}>
            <Card>
              <CardHeader>
                <CardTitle>Customer Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="customerName">Full Name</Label>
                  <Input
                    id="customerName"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className={errors.customerName ? "border-red-500" : ""}
                  />
                  {errors.customerName && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.customerName}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="customerEmail">Email</Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className={errors.customerEmail ? "border-red-500" : ""}
                  />
                  {errors.customerEmail && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.customerEmail}
                    </p>
                  )}
                </div>
              </CardContent>

              <CardHeader>
                <CardTitle>Shipping Address</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="shippingStreet">Street</Label>
                  <Input
                    id="shippingStreet"
                    value={shippingAddress.street}
                    onChange={(e) =>
                      handleShippingAddressChange("street", e.target.value)
                    }
                    className={errors.shippingStreet ? "border-red-500" : ""}
                  />
                  {errors.shippingStreet && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.shippingStreet}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="shippingCity">City</Label>
                    <Input
                      id="shippingCity"
                      value={shippingAddress.city}
                      onChange={(e) =>
                        handleShippingAddressChange("city", e.target.value)
                      }
                      className={errors.shippingCity ? "border-red-500" : ""}
                    />
                    {errors.shippingCity && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.shippingCity}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="shippingState">State</Label>
                    <Input
                      id="shippingState"
                      value={shippingAddress.state}
                      onChange={(e) =>
                        handleShippingAddressChange("state", e.target.value)
                      }
                      className={errors.shippingState ? "border-red-500" : ""}
                    />
                    {errors.shippingState && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.shippingState}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="shippingPostalCode">Postal Code</Label>
                    <Input
                      id="shippingPostalCode"
                      value={shippingAddress.postal_code}
                      onChange={(e) =>
                        handleShippingAddressChange(
                          "postal_code",
                          e.target.value,
                        )
                      }
                      className={
                        errors.shippingPostalCode ? "border-red-500" : ""
                      }
                    />
                    {errors.shippingPostalCode && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.shippingPostalCode}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="shippingCountry">Country</Label>
                    <Input
                      id="shippingCountry"
                      value={shippingAddress.country}
                      onChange={(e) =>
                        handleShippingAddressChange("country", e.target.value)
                      }
                      className={errors.shippingCountry ? "border-red-500" : ""}
                    />
                    {errors.shippingCountry && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.shippingCountry}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="sameAsBilling"
                    checked={sameAsBilling}
                    onCheckedChange={(checked) =>
                      handleSameAsBillingChange(checked as boolean)
                    }
                  />
                  <Label htmlFor="sameAsBilling">
                    Billing address same as shipping
                  </Label>
                </div>
              </CardContent>

              {!sameAsBilling && (
                <>
                  <CardHeader>
                    <CardTitle>Billing Address</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="billingStreet">Street</Label>
                      <Input
                        id="billingStreet"
                        value={billingAddress.street}
                        onChange={(e) =>
                          handleBillingAddressChange("street", e.target.value)
                        }
                        className={errors.billingStreet ? "border-red-500" : ""}
                      />
                      {errors.billingStreet && (
                        <p className="text-red-500 text-sm mt-1">
                          {errors.billingStreet}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="billingCity">City</Label>
                        <Input
                          id="billingCity"
                          value={billingAddress.city}
                          onChange={(e) =>
                            handleBillingAddressChange("city", e.target.value)
                          }
                          className={errors.billingCity ? "border-red-500" : ""}
                        />
                        {errors.billingCity && (
                          <p className="text-red-500 text-sm mt-1">
                            {errors.billingCity}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="billingState">State</Label>
                        <Input
                          id="billingState"
                          value={billingAddress.state}
                          onChange={(e) =>
                            handleBillingAddressChange("state", e.target.value)
                          }
                          className={
                            errors.billingState ? "border-red-500" : ""
                          }
                        />
                        {errors.billingState && (
                          <p className="text-red-500 text-sm mt-1">
                            {errors.billingState}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="billingPostalCode">Postal Code</Label>
                        <Input
                          id="billingPostalCode"
                          value={billingAddress.postal_code}
                          onChange={(e) =>
                            handleBillingAddressChange(
                              "postal_code",
                              e.target.value,
                            )
                          }
                          className={
                            errors.billingPostalCode ? "border-red-500" : ""
                          }
                        />
                        {errors.billingPostalCode && (
                          <p className="text-red-500 text-sm mt-1">
                            {errors.billingPostalCode}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="billingCountry">Country</Label>
                        <Input
                          id="billingCountry"
                          value={billingAddress.country}
                          onChange={(e) =>
                            handleBillingAddressChange(
                              "country",
                              e.target.value,
                            )
                          }
                          className={
                            errors.billingCountry ? "border-red-500" : ""
                          }
                        />
                        {errors.billingCountry && (
                          <p className="text-red-500 text-sm mt-1">
                            {errors.billingCountry}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </>
              )}

              <CardFooter className="flex justify-between">
                {errors.submit && (
                  <p className="text-red-500">{errors.submit}</p>
                )}
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/")}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Place Order"
                    )}
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </form>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {basket.map((item) => (
                <div key={item.id} className="flex justify-between">
                  <span>
                    {item.quantity}x {item.name}
                  </span>
                  <span>${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}

              <Separator />

              <div className="flex justify-between font-medium">
                <span>Subtotal</span>
                <span>${getBasketTotal().toFixed(2)}</span>
              </div>

              <div className="flex justify-between font-medium">
                <span>Shipping</span>
                <span>Free</span>
              </div>

              <Separator />

              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>${getBasketTotal().toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Secure Checkout</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 mb-4">
                This is a secure checkout process. Your information is encrypted
                and securely processed.
              </p>
              <div className="flex items-center gap-2">
                <svg
                  className="h-8 w-8"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M9 12L11 14L15 10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-sm">SSL Secure Payment</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
