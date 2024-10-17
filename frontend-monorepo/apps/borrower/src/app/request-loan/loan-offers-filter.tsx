import {
  LtvInfoLabel,
  parseStableCoin,
  StableCoin,
  StableCoinDropdown,
  StableCoinHelper,
} from "@frontend-monorepo/ui-shared";
import { Box, Button, Flex, Separator, Text, TextField } from "@radix-ui/themes";
import React from "react";
import { FaInfoCircle } from "react-icons/fa";
import { Slider, SliderProps } from "./slider";

export interface LoanFilter {
  amount?: number;
  stableCoin?: StableCoin;
  ltv?: number;
  interest?: number;
  period?: number;
}

export enum TableSortBy {
  Lender = "Lender",
  Amount = "Amount",
  Duration = "Duration",
  Ltv = "Ltv",
  Interest = "Interest",
}

export function parseTableSortBy(value: string): TableSortBy | undefined {
  if (Object.values(TableSortBy).includes(value as TableSortBy)) {
    return value as TableSortBy;
  }
  return undefined;
}

interface LoanOffersFilterProps {
  loanFilter: LoanFilter;
  onChange: (filter: LoanFilter) => void;
}

function LoanOffersFilter({ onChange, loanFilter }: LoanOffersFilterProps) {
  const resetAmount = React.useRef<HTMLInputElement>(null);
  const [resetCoin, setResetcoin] = React.useState(true);
  const [resetRatio, setResetRatio] = React.useState(true);
  const [resetDuration, setResetDuration] = React.useState(true);
  const [resetInterest, setResetInterest] = React.useState(true);

  const ltvSliderProps: SliderProps = {
    min: 30,
    max: 90,
    step: 1,
    init: loanFilter.ltv ?? 30,
    suffix: "%",
    reset: resetRatio,
    onChange: (value) => {
      const filter: LoanFilter = { ...loanFilter, ltv: value };
      onChange(filter);
    },
  };
  const interestSliderProps: SliderProps = {
    min: 1,
    max: 100,
    step: 1,
    init: loanFilter.interest ?? 100,
    suffix: "%",
    reset: resetInterest,
    onChange: (value) => {
      const filter: LoanFilter = { ...loanFilter, interest: value };
      onChange(filter);
    },
  };

  const periodSliderProps: SliderProps = {
    min: 1,
    max: 12,
    step: 1,
    init: loanFilter.period ?? 12,
    suffix: " months",
    reset: resetDuration,
    onChange: (value) => {
      const filter: LoanFilter = { ...loanFilter, period: value };
      onChange(filter);
    },
  };

  function onStableCoinSelect(value: StableCoin | undefined) {
    let stableCoin;
    if (value) {
      stableCoin = value;
    }
    const filter: LoanFilter = { ...loanFilter, stableCoin };

    onChange(filter);
  }

  function onAmountChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const value = e.target.value ? Number(e.target.value) : undefined;
    const filter: LoanFilter = { ...loanFilter, amount: value };
    onChange(filter);
  }

  // Individual Clearing Options

  const clearAmount = () => {
    const filter: LoanFilter = { ...loanFilter, amount: undefined };
    if (resetAmount.current) {
      resetAmount.current.value = "";
      onChange(filter);
    }
  };

  const clearCoin = () => {
    const filter: LoanFilter = { ...loanFilter, stableCoin: undefined };
    onChange(filter);
    if (resetCoin) {
      setResetcoin(false);
      setTimeout(() => {
        setResetcoin(true);
      }, 2000);
    }
  };

  const clearRatio = () => {
    const filter: LoanFilter = { ...loanFilter, ltv: undefined };
    onChange(filter);
    if (resetRatio) {
      setResetRatio(false);
      setTimeout(() => {
        setResetRatio(true);
      }, 2000);
    }
  };

  const clearInterest = () => {
    const filter: LoanFilter = { ...loanFilter, interest: undefined };
    onChange(filter);
    if (resetInterest) {
      setResetInterest(false);
      setTimeout(() => {
        setResetInterest(true);
      }, 2000);
    }
  };
  const clearDuration = () => {
    const filter: LoanFilter = { ...loanFilter, period: undefined };
    onChange(filter);
    if (resetDuration) {
      setResetDuration(false);
      setTimeout(() => {
        setResetDuration(true);
      }, 2000);
    }
  };

  // Reset filter action
  function onRestAll() {
    if (resetAmount.current) {
      resetAmount.current.value = "";
    }
    if (resetCoin || resetRatio || resetInterest || resetDuration) {
      setResetcoin(false);
      setResetRatio(false);
      setResetInterest(false);
      setResetDuration(false);
      setTimeout(() => {
        setResetcoin(true);
        setResetRatio(true);
        setResetInterest(true);
        setResetDuration(true);
      }, 2000);
    }
    const filter: LoanFilter = {};
    onChange(filter);
  }

  return (
    <Flex className="flex-col h-full justify-between">
      <Box>
        <Box className={"p-4 w-full"}>
          <Flex className={"flex items-center justify-between mb-2"}>
            <Text as="label" className="text-sm font-medium text-font">
              Amount
            </Text>
            <Button
              onClick={clearAmount}
              size={"1"}
              variant="ghost"
              className="hover:bg-transparent"
            >
              <Text className={"text-xs font-medium text-font"}>
                Reset
              </Text>
            </Button>
          </Flex>
          <TextField.Root
            type="number"
            ref={resetAmount}
            className="text-sm focus:border-purple-800/50 p-3 rounded-lg"
            placeholder="Input an amount…"
            value={loanFilter.amount}
            onChange={onAmountChange}
          />
        </Box>
        <Separator size="4" />
        <Box className={"p-4 w-full"}>
          <Flex className={"flex items-center justify-between mb-2"}>
            <Text as="label" className="text-sm font-medium text-font">
              Coin type
            </Text>
            <Button
              onClick={clearCoin}
              size={"1"}
              variant="ghost"
              className="hover:bg-transparent"
            >
              <Text className={"text-xs font-medium text-font"}>
                Reset
              </Text>
            </Button>
          </Flex>
          <StableCoinDropdown
            coins={StableCoinHelper.all()}
            defaultCoin={loanFilter.stableCoin}
            filter={resetCoin}
            onSelect={onStableCoinSelect}
          />
        </Box>

        <Separator size="4" />
        <Box className={"p-4 w-full"}>
          <Flex className={"flex items-center justify-between mb-2"}>
            <LtvInfoLabel>
              <Text as="label" className="text-sm font-medium text-font">
                LTV ratio
              </Text>
              <FaInfoCircle color={"gray"} />
            </LtvInfoLabel>
            <Button
              onClick={clearRatio}
              size={"1"}
              variant="ghost"
              className="hover:bg-transparent"
            >
              <Text className={"text-xs font-medium text-font"}>
                Reset
              </Text>
            </Button>
          </Flex>
          <Slider {...ltvSliderProps} />
        </Box>

        <Separator size="4" />
        <Box className={"p-4 w-full"}>
          <Flex className={"flex items-center justify-between mb-2"}>
            <Text as="label" className="text-sm font-medium text-font">
              Interest rate p.a.
            </Text>
            <Button
              onClick={clearInterest}
              size={"1"}
              variant="ghost"
              className="hover:bg-transparent"
            >
              <Text className={"text-xs font-medium text-font"}>
                Reset
              </Text>
            </Button>
          </Flex>
          <Slider {...interestSliderProps} />
        </Box>

        <Separator size="4" />
        <Box className={"p-4 w-full"}>
          <Flex className={"flex items-center justify-between mb-2"}>
            <Text as="label" className="text-sm font-medium text-font">
              Period
            </Text>
            <Button
              onClick={clearDuration}
              size={"1"}
              variant="ghost"
              className="hover:bg-transparent"
            >
              <Text className={"text-xs font-medium text-font"}>
                Reset
              </Text>
            </Button>
          </Flex>
          <Slider {...periodSliderProps} />
        </Box>
      </Box>

      <Box>
        <Separator size="4" className="mt-auto" />
        <Box className={"p-4 w-full"}>
          <Button
            onClick={onRestAll}
            variant="outline"
            color="gray"
            className="p-3 rounded-lg w-full active:scale-90 transition-transform duration-200 ease-in-out"
          >
            <Text className="text-sm font-medium text-font" weight={"medium"}>
              Reset all
            </Text>
          </Button>
        </Box>
      </Box>
    </Flex>
  );
}

export default LoanOffersFilter;
