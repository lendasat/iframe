import {
  Box,
  Flex,
  Heading,
  ScrollArea,
  Select,
  Slider,
  Text,
  TextField,
} from "@radix-ui/themes";
import { type ChangeEvent, useState } from "react";
import SingleDurationSelector from "../loan-offers/DurationSelector";
import { useSearchParams } from "react-router-dom";
import { Form } from "react-bootstrap";
import { LoanAsset, LoanAssetHelper } from "@frontend/ui-shared";
import { Confirmation } from "./confirmation";

export default function LoanApplication() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loanAmount, setLoanAmount] = useState<string>(
    (searchParams.get("amount") as string) || "1000",
  );
  const [assetType, setAssetType] = useState<LoanAsset>(
    (searchParams.get("asset") as LoanAsset) || LoanAsset.USDC_POL,
  );
  const [interestRate, setInterestRate] = useState<string>(
    (searchParams.get("interest") as string) || "13.5",
  );
  const [loanDuration, setLoanDuration] = useState<string>(
    (searchParams.get("duration") as string) || "7",
  );

  const onLoanAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    const newLoanAmount = e.target.value;
    setLoanAmount(newLoanAmount);

    setSearchParams((params) => {
      params.set("amount", newLoanAmount);
      return params;
    });
  };

  const onSetLoanDuration = (days: number) => {
    setLoanDuration(days.toString());
    setSearchParams((params) => {
      params.set("duration", days.toString());
      return params;
    });
  };

  const onInterestRateChange = (interest: number[]) => {
    const selectedInterestRate = interest[0].toString();
    setInterestRate(selectedInterestRate);
    setSearchParams((params) => {
      params.set("interest", selectedInterestRate);
      return params;
    });
  };

  const onAssetChange = (asset: LoanAsset) => {
    setAssetType(asset);
    setSearchParams((params) => {
      params.set("assetType", asset);
      return params;
    });
  };

  const availableLoanAssets = LoanAssetHelper.all().filter((a) =>
    LoanAssetHelper.isStableCoin(a),
  );
  return (
    <ScrollArea type="always" scrollbars="vertical">
      <Form className="space-y-4">
        <Flex direction={"column"} gap={"4"}>
          <Flex direction={"column"} className="py-8">
            <Flex direction={"column"} mx="auto" className="text-center">
              <Heading
                size="7"
                className="text-font dark:text-font-dark font-semibold"
              >
                Apply for a new loan
              </Heading>
              <Text
                size={"2"}
                weight={"medium"}
                mt={"4"}
                className="text-font dark:text-font-dark shrink-0"
              >
                Set your own loan terms and get matched with a lender.
              </Text>
            </Flex>

            <Flex
              direction={"column"}
              className="justify-center"
              mt={"6"}
              px={"6"}
            >
              {/* Amount and Currency */}
              <Flex
                gap={"4"}
                direction={{ initial: "column", sm: "row" }}
                className="w-full"
              >
                <Flex direction="column" gap="1" className="w-full">
                  <Text
                    className="text-font dark:text-font-dark"
                    as="label"
                    size={"2"}
                    weight={"medium"}
                  >
                    How much do you wish to borrow?
                  </Text>
                  <TextField.Root
                    size={"3"}
                    variant="surface"
                    type="number"
                    color="gray"
                    min={1}
                    onChange={onLoanAmountChange}
                    className="text-font dark:text-font-dark w-full rounded-lg text-sm"
                    value={loanAmount}
                  >
                    <TextField.Slot>
                      <Text size={"3"} weight={"medium"}>
                        $
                      </Text>
                    </TextField.Slot>
                  </TextField.Root>
                </Flex>
                <Flex direction="column" gap="1" className="w-full">
                  <Text
                    className="text-font dark:text-font-dark"
                    as="label"
                    size={"2"}
                    weight={"medium"}
                  >
                    What do you want to borrow?
                  </Text>
                  <Select.Root
                    value={assetType}
                    size={"3"}
                    onValueChange={(value) => onAssetChange(value as LoanAsset)}
                  >
                    <Select.Trigger />
                    <Select.Content>
                      <Select.Group>
                        {availableLoanAssets.map((asset: LoanAsset) => (
                          <Select.Item key={asset.toString()} value={asset}>
                            <Text
                              className="text-font dark:text-font-dark"
                              as="label"
                              size={"2"}
                              weight={"medium"}
                            >
                              {LoanAssetHelper.print(asset)}
                            </Text>
                          </Select.Item>
                        ))}
                      </Select.Group>
                    </Select.Content>
                  </Select.Root>
                </Flex>
              </Flex>

              {/* Loan Duration */}
              <Flex direction="column" gap="1" className="w-full">
                <Text
                  className="text-font dark:text-font-dark"
                  as="label"
                  size={"2"}
                  weight={"medium"}
                >
                  For how long do you want to borrow?
                </Text>
                <Box className="w-full">
                  <SingleDurationSelector
                    selectedDuration={
                      loanDuration ? Number.parseInt(loanDuration) : undefined
                    }
                    onDurationChange={onSetLoanDuration}
                    disabled={false}
                  />
                </Box>
              </Flex>

              {/* Loan Interest */}
              <Flex direction="column" gap="1" className="w-full">
                <Flex justify={"between"} align={"center"}>
                  <Text
                    className="text-font dark:text-font-dark"
                    as="label"
                    size={"2"}
                    weight={"medium"}
                  >
                    Preferred interest rate (p.a. %)
                  </Text>
                  <Box className="rounded-lg border border-gray-200" p={"2"}>
                    <Text
                      className="text-font dark:text-font-dark"
                      as="label"
                      size={"2"}
                      align={"center"}
                      weight={"light"}
                    >
                      {interestRate} %
                    </Text>
                  </Box>
                </Flex>
                <Box className="w-full" mt={"2"}>
                  <Slider
                    defaultValue={[50]}
                    onValueChange={(val) => onInterestRateChange(val)}
                    value={[Number.parseInt(interestRate)]}
                    min={5}
                    max={20}
                    step={0.5}
                  ></Slider>
                </Box>
              </Flex>
            </Flex>
          </Flex>
          {/* Loan address input fields */}
          <Flex direction="column" gap="1" className="w-full" px={"6"}>
            <Confirmation
              selectedAssetType={assetType}
              selectedLoanDuration={loanDuration}
              selectedLoanAmount={loanAmount}
              selectedInterestRate={interestRate}
              originationFee={0.015} // TODO: fixme: where do we get this from?
            />
          </Flex>
        </Flex>
      </Form>
    </ScrollArea>
  );
}
