import { Contract } from "@frontend-monorepo/http-client-borrower";
import { StableCoinHelper } from "@frontend-monorepo/ui-shared";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import { Box, Callout, Flex, Heading, Select } from "@radix-ui/themes";
import { useState } from "react";
import { ExtendContract } from "./extend-contract";
import { RepayContract } from "./repay-contract";

interface ContractPrincipalGivenProps {
  interestAmount: number;
  totalRepaymentAmount: number;
  contract: Contract;
}

export function ContractPrincipalGiven({
  interestAmount,
  totalRepaymentAmount,
  contract,
}: ContractPrincipalGivenProps) {
  const [action, setAction] = useState<string>("");

  const coin = StableCoinHelper.mapFromBackend(
    contract.loan_asset_chain,
    contract.loan_asset_type,
  );
  const expiry = contract.expiry;
  const contractId = contract.id;
  const loanAmount = contract.loan_amount;
  const repaymentAddress = contract.loan_repayment_address;

  return (
    <Box>
      <Flex gap={"2"} className={"items-center"}>
        <Heading
          className={"text-font dark:text-font-dark"}
          size={"4"}
          weight={"medium"}
        >
          I want to
        </Heading>
        <Select.Root
          value={action}
          onValueChange={(newValue) => setAction(newValue)}
        >
          <Select.Trigger className={"text-font dark:text-font-dark"} />
          <Select.Content className={"bg-white dark:bg-dark"}>
            <Select.Group>
              <Select.Item
                className={"text-font dark:text-font-dark"}
                value="repay"
              >
                <div className={"text-font dark:text-font-dark "}>
                  pay back the contract.
                </div>
              </Select.Item>
              <Select.Item
                className={"text-font dark:text-font-dark"}
                value="extend"
              >
                <div className={"text-font dark:text-font-dark"}>
                  extend the contract.
                </div>
              </Select.Item>
            </Select.Group>
          </Select.Content>
        </Select.Root>
      </Flex>
      {action === "repay" && (
        <RepayContract
          contractId={contractId}
          loanAmount={loanAmount}
          interestAmount={interestAmount}
          totalRepaymentAmount={totalRepaymentAmount}
          expiry={expiry}
          stableCoin={coin}
          repaymentAddress={repaymentAddress}
        />
      )}
      {action === "extend" && (
        <ExtendContract
          contract={contract}
          coin={coin}
          resetSelectedAction={() => setAction("")}
        />
      )}
      {action !== "extend" && action !== "repay" && (
        <Callout.Root>
          <Callout.Icon>
            <InfoCircledIcon />
          </Callout.Icon>
          <Callout.Text>
            Please select whether you want to repay now or extend your contract.
          </Callout.Text>
        </Callout.Root>
      )}
    </Box>
  );
}
