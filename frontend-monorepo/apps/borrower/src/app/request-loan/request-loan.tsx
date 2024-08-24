import { LoanOffer, StableCoin } from "./loan-offer";
import LoanOffersComponent from "./loan-offers";

function RequestLoan() {
  return (
    <>
      <LoanOffersComponent loanOffers={getMockData()} />
    </>
  );
}

// TODO: fetch from backend
function getMockData(): LoanOffer[] {
  const loanOffer1: LoanOffer = {
    lender: {
      name: "Lord Lendalot 1",
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
      name: "Lord Lendalot 2",
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

  const loanOffer3: LoanOffer = {
    lender: {
      name: "Lord Lendalot 3",
      rate: 100,
      loans: 240,
    },
    amount: {
      min: 5000,
      max: 50000,
    },
    duration: {
      min: 3,
      max: 6,
    },
    ltv: 40,
    interest: 8,
    coins: [StableCoin.USDT_ETH],
  };

  return [loanOffer1, loanOffer2, loanOffer3];
}

export default RequestLoan;
