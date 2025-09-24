import { LoanProductOption } from "@frontend/http-client-borrower";

interface ToSProps {
  product?: LoanProductOption;
}

function LendasatToS() {
  return (
    <p className="text-xs text-muted-foreground mt-1 whitespace-normal">
      By requesting a loan you accept our{" "}
      <a
        href="https://tos.lendasat.com/"
        className="text-primary hover:underline inline-block"
        target="_blank"
        rel="noopener noreferrer"
      >
        Terms and Conditions
      </a>
      .
    </p>
  );
}

function PayWithMoon() {
  return (
    <p className="text-xs text-muted-foreground mt-1 whitespace-normal">
      By requesting a loan you accept our{" "}
      <a
        href="https://tos.lendasat.com/"
        className="text-primary hover:underline inline-block"
        target="_blank"
        rel="noopener noreferrer"
      >
        Lendasat Terms & Conditions
      </a>
      {" and "}
      <a
        href="https://paywithmoon.com/terms-conditions"
        className="text-primary hover:underline inline-block"
        target="_blank"
        rel="noopener noreferrer"
      >
        Moon Terms & Conditions
      </a>
      {" and "}
      <a
        href="https://paywithmoon.com/terms-conditions"
        className="text-primary hover:underline inline-block"
        target="_blank"
        rel="noopener noreferrer"
      >
        Card Holder Agreement
      </a>
      {" and "}
      <a
        href="https://paywithmoon.com/terms-conditions"
        className="text-primary hover:underline inline-block"
        target="_blank"
        rel="noopener noreferrer"
      >
        Statement of Eligibility
      </a>
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
