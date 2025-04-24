import { Link, Text } from "@radix-ui/themes";
import { LoanProductOption } from "@frontend/http-client-borrower";

interface ToSProps {
  product?: LoanProductOption;
}

function LendasatToS() {
  return (
    <Text size={"1"} weight={"light"} m={"1"}>
      By requesting a loan you accept our{" "}
      <Link
        href={"https://tos.lendasat.com/"}
        className="text-blue-600 hover:underline dark:text-blue-400"
        target="_blank"
        rel="noopener noreferrer"
      >
        Terms and Conditions
      </Link>
      .
    </Text>
  );
}
function PayWithMoon() {
  return (
    <Text size={"1"} weight={"light"} m={"1"}>
      By requesting a loan you accept our{" "}
      <Link
        href="https://tos.lendasat.com/"
        className="text-blue-600 hover:underline dark:text-blue-400"
        target="_blank"
        rel="noopener noreferrer"
      >
        Lendasat Terms & Conditions
      </Link>
      {" and "}
      <Link
        href="https://paywithmoon.com/terms-conditions"
        className="text-blue-600 hover:underline dark:text-blue-400"
        target="_blank"
        rel="noopener noreferrer"
      >
        Moon Terms & Conditions
      </Link>
      {" and "}
      <Link
        href="https://paywithmoon.com/terms-conditions"
        className="text-blue-600 hover:underline dark:text-blue-400"
        target="_blank"
        rel="noopener noreferrer"
      >
        Card Holder Agreement
      </Link>
      {" and "}
      <Link
        href="https://paywithmoon.com/terms-conditions"
        className="text-blue-600 hover:underline dark:text-blue-400"
        target="_blank"
        rel="noopener noreferrer"
      >
        Statement of Eligibility
      </Link>
    </Text>
  );
}

export function ToS({ product }: ToSProps) {
  if (product === LoanProductOption.PayWithMoonDebitCard) {
    return <PayWithMoon />;
  }

  // in any other case it's just our ToS
  return <LendasatToS />;
}
