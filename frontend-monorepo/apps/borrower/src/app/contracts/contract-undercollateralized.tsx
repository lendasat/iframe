import { faExclamationCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export function ContractUndercollateralized() {
  return (
    <div className="rounded-md border-l-4 border-red-500 bg-red-50 p-4 text-red-700">
      <div className="flex items-center">
        <FontAwesomeIcon icon={faExclamationCircle} className="mr-2 h-4 w-4" />
        <p>
          Your contract LTV ratio reached the liquidation threshold. We are
          waiting for the lender to liquidate the collateral. The remainder will
          be sent to your refund address.
        </p>
      </div>
    </div>
  );
}
