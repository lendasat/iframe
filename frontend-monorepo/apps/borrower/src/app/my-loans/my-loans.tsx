import { useNavigate } from "react-router-dom";
import CollapsibleComponent from "../collapsible";
import { Loan, LoanStatus } from "./loan";
import LoansComponent from "./loans";
import LoansHistoryComponent from "./loans-history";

function MyLoans() {
  const loans = getMockData();
  const navigate = useNavigate();
  return (
    <>
      <div className="p-4">
        <LoansComponent
          loans={loans.filter((loan) => loan.status !== LoanStatus.CLOSED)}
          onRepay={(loan_id) => {
            navigate(`repay/${loan_id}`);
          }}
          onCollateralize={(loan_id) => {
            navigate(`collateralize/${loan_id}`);
          }}
        />
      </div>
      <div className="px-4">
        <CollapsibleComponent
          title={"History"}
          children={<LoansHistoryComponent loans={loans.filter((loan) => loan.status === LoanStatus.CLOSED)} />}
        />
      </div>
    </>
  );
}

export default MyLoans;

// TODO: fetch from backend
function getMockData(): Loan[] {
  const loan1: Loan = {
    id: "025501c3-bce2-4858-a0f2-109ed1c62d92",
    amount: 10000,
    opened: new Date(),
    repaid: new Date(),
    expiry: new Date(),
    interest: 8,
    collateral: 0.253,
    status: LoanStatus.ACCEPTED,
    lender: {
      name: "Lord Lendalot 1",
      rate: 100,
      loans: 240,
    },
  };

  const loan2: Loan = {
    id: "06a98ef2-3f4b-4c78-8fd1-9e8f7329da78",
    amount: 14000,
    opened: new Date(),
    repaid: new Date(),
    expiry: new Date(),
    interest: 11,
    collateral: 0.465,
    status: LoanStatus.OPEN,
    lender: {
      name: "Lord Lendalot 2",
      rate: 99,
      loans: 345,
    },
  };

  const loan3: Loan = {
    id: "761c6c74-5dba-4201-ba7d-1d7624700ae9",
    amount: 12000,
    opened: new Date(),
    repaid: new Date(),
    expiry: new Date(),
    interest: 10,
    collateral: 0.237,
    status: LoanStatus.CLOSING,
    lender: {
      name: "Lord Lendalot 3",
      rate: 100,
      loans: 2400,
    },
  };

  const loan4: Loan = {
    id: "973f83ff-8bc8-4ffe-9920-05948dc09fe0",
    amount: 25000,
    opened: new Date(),
    repaid: new Date(),
    expiry: new Date(),
    interest: 9,
    collateral: 0.867,
    status: LoanStatus.CLOSED,
    lender: {
      name: "Lord Lendalot 4",
      rate: 95,
      loans: 140,
    },
  };

  return [loan1, loan2, loan3, loan4];
}
