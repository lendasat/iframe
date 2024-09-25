import React from "react";
import { Form } from "react-bootstrap";
import { Slider, SliderProps } from "./slider";
import { parseStableCoin, StableCoin, StableCoinDropdown, StableCoinHelper } from "./stable-coin";

export interface LoanFilter {
  amount?: number;
  stableCoin?: StableCoin;
  ltv?: number;
  interest?: number;
  period?: number;
}

interface LoanOffersFilterProps {
  loanFilter: LoanFilter;
  onChange: (filter: LoanFilter) => void;
}

function LoanOffersFilter({ onChange, loanFilter }: LoanOffersFilterProps) {
  const ltvSliderProps: SliderProps = {
    min: 30,
    max: 90,
    step: 1,
    init: loanFilter.ltv ?? 30,
    suffix: "%",
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
    onChange: (value) => {
      const filter: LoanFilter = { ...loanFilter, period: value };
      onChange(filter);
    },
  };

  function onStableCoinSelect(value: string) {
    const filter: LoanFilter = { ...loanFilter, stableCoin: parseStableCoin(value) };

    onChange(filter);
  }

  function onAmountChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const value = e.target.value ? Number(e.target.value) : undefined;
    const filter: LoanFilter = { ...loanFilter, amount: value };
    onChange(filter);
  }

  return (
    <Form className={"space-y-1 pb-3"}>
      <Form.Group controlId="loan-amount">
        <Form.Label column={true}>
          <small className="text-xs font-medium">Loan Amount</small>
        </Form.Label>
        <Form.Control
          className="shadow-none focus:border-font/10 w-full"
          value={loanFilter.amount}
          onChange={onAmountChange}
        />
      </Form.Group>
      <Form.Group className="flex flex-col" controlId="stable-coin">
        <Form.Label column={true}>
          <small className="text-xs font-medium">Stable coin</small>
        </Form.Label>
        <StableCoinDropdown
          coins={StableCoinHelper.all()}
          defaultCoin={loanFilter.stableCoin}
          filter={true}
          onSelect={onStableCoinSelect}
        />
      </Form.Group>
      <Form.Group controlId="ltv-slider">
        <Form.Label column={true}>
          <small className="text-xs font-medium">LTV ratio</small>
        </Form.Label>
        <Slider {...ltvSliderProps} />
      </Form.Group>
      <Form.Group controlId="interest-slider">
        <Form.Label column={true}>
          <small className="text-xs font-medium">Interest rate p.a.</small>
        </Form.Label>
        <Slider {...interestSliderProps} />
      </Form.Group>
      <Form.Group controlId="interest-slider">
        <Form.Label column={true}>
          <small className="text-xs font-medium">Period</small>
        </Form.Label>
        <Slider {...periodSliderProps} />
      </Form.Group>
    </Form>
  );
}

export default LoanOffersFilter;
