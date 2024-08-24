import { LoanOffer, LoanOfferComponent, StableCoin } from "./loan-offer";

function RequestLoan() {
  const loanOffer: LoanOffer = {
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

  return (
    <>
      <LoanOfferComponent {...loanOffer}></LoanOfferComponent>
    </>
  );
}

export default RequestLoan;
