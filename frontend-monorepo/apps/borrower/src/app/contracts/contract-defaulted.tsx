import { faExclamationCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export function ContractDefaulted() {
  return (
    <div className="px-4">
      <div className="flex items-center rounded border border-red-400 bg-red-100 p-4 text-red-700">
        <FontAwesomeIcon icon={faExclamationCircle} className="mr-2 h-4 w-4" />
        You have defaulted on your contract. We are waiting for the lender to
        liquidate the collateral. The remainder will be sent to your refund
        address.
      </div>
    </div>
  );
}
