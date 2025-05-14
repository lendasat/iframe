import { Link } from "@radix-ui/themes";
import { LoanProductOption } from "@frontend/http-client-borrower";

interface ToSProps {
  product?: LoanProductOption;
}

function LendasatToS() {
  return (
    <p className="text-xs text-muted-foreground mt-1 whitespace-normal">
      By requesting a loan you accept our{" "}
      <Link
        href="https://tos.lendasat.com/"
        className="text-primary hover:underline inline-block"
        target="_blank"
        rel="noopener noreferrer"
      >
        Terms and Conditions
      </Link>
      .
    </p>
  );
}

function PayWithMoon() {
  return (
    <p className="text-xs text-muted-foreground mt-1 whitespace-normal">
      By requesting a loan you accept our{" "}
      <Link
        href="https://tos.lendasat.com/"
        className="text-primary hover:underline inline-block"
        target="_blank"
        rel="noopener noreferrer"
      >
        Lendasat Terms & Conditions
      </Link>
      {" and "}
      <Link
        href="https://paywithmoon.com/terms-conditions"
        className="text-primary hover:underline inline-block"
        target="_blank"
        rel="noopener noreferrer"
      >
        Moon Terms & Conditions
      </Link>
      {" and "}
      <Link
        href="https://paywithmoon.com/terms-conditions"
        className="text-primary hover:underline inline-block"
        target="_blank"
        rel="noopener noreferrer"
      >
        Card Holder Agreement
      </Link>
      {" and "}
      <Link
        href="https://paywithmoon.com/terms-conditions"
        className="text-primary hover:underline inline-block"
        target="_blank"
        rel="noopener noreferrer"
      >
        Statement of Eligibility
      </Link>
    </p>
  );
}

export function ToS({ product }: ToSProps) {
  if (product === LoanProductOption.PayWithMoonDebitCard) {
    return <PayWithMoon />;
  }

  // in any other case it's just our ToS
  return <LendasatToS />;
}
