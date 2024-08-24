import { LoanOffer, StableCoin } from "./loan-offer";
import LoanOffersComponent from "./loan-offers";

function RequestLoan() {
  const loanOffer1: LoanOffer = {
    lender: {
      name: "Lord Lendalot",
      rate: 100,
      loans: 240,
    },
    amount: {
      min: 10000,
      max: 100000,
    },
    duration: {
      min: 3,
      max: 6,
    },
    ltv: 66,
    interest: 12,
    coins: [StableCoin.USDT_SN, StableCoin.USDC_SN],
  };

  const loanOffer2: LoanOffer = {
    lender: {
      name: "Lord Lendalot",
      rate: 100,
      loans: 240,
    },
    amount: {
      min: 5000,
      max: 50000,
    },
    duration: {
      min: 6,
      max: 12,
    },
    ltv: 50,
    interest: 8,
    coins: [StableCoin.USDT_ETH],
  };

  return (
    <>
      <LoanOffersComponent loanOffers={[loanOffer1, loanOffer2]} />
    </>
  );
}

export default RequestLoan;
