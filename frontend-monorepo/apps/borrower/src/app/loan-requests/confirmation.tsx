export type ServiceType = "stable" | "card" | "fiat";

interface ConfirmationProps {
  serviceType?: ServiceType;
  offerId?: number;
}

export const Confirmation = ({ serviceType, offerId }: ConfirmationProps) => {
  if (!serviceType || !offerId) return null;

  const renderForm = () => {
    switch (serviceType) {
      case "stable":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Wallet Address</h3>
            <input
              type="text"
              placeholder="Enter your wallet address"
              className="w-full p-2 border border-gray-200 rounded-lg"
            />
          </div>
        );
      case "fiat":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Bank Details</h3>
            <input
              type="text"
              placeholder="Account number"
              className="w-full p-2 border border-gray-200 rounded-lg"
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6 border border-gray-200 rounded-lg">
      <h2 className="text-xl font-semibold mb-6">Confirm Your Application</h2>
      {renderForm()}
    </div>
  );
};
