import { faExclamationCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export function ContractPrincipalRepaid() {
  return (
    <div className="w-full px-4">
      <div className="mb-4 flex items-center rounded border border-[#bee5eb] bg-[#d1ecf1] p-4 text-[#0c5460]">
        <FontAwesomeIcon icon={faExclamationCircle} className="mr-2 h-4 w-4" />
        Contract has been marked as repaid. Once the lender confirms the
        repayment, you will be able to withdraw the collateral from the
        contract.
      </div>
    </div>
  );
}
