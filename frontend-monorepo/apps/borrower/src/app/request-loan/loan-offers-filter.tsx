import React from "react";
import { Form } from "react-bootstrap";
import { Slider, SliderProps } from "./slider";
import { StableCoin, StableCoinDropdown, StableCoinHelper } from "./stable-coin";

export enum LoanFilterType {
  AMOUNT = "AMOUNT",
  STABLECOIN = "STABLECOIN",
  LTV = "LTV",
  INTEREST = "INTEREST",
  PERIOD = "PERIOD",
}

export class LoanFilter {
  type: LoanFilterType;
  value: number | StableCoin;
}

function LoanOffersFilter({ onChange }) {
  const ltvSliderProps: SliderProps = {
    min: 30,
    max: 100,
    step: 1,
    init: 100,
    suffix: "%",
    onChange: (value) => {
      const filter: LoanFilter = { type: LoanFilterType.LTV, value };
      onChange(filter);
    },
  };
  const interestSliderProps: SliderProps = {
    min: 1,
    max: 30,
    step: 1,
    init: 30,
    suffix: "%",
    onChange: (value) => {
      const filter: LoanFilter = { type: LoanFilterType.INTEREST, value };
      onChange(filter);
    },
  };

  const periodSliderProps: SliderProps = {
    min: 1,
    max: 12,
    step: 1,
    init: 12,
    suffix: " months",
    onChange: (value) => {
      const filter: LoanFilter = { type: LoanFilterType.PERIOD, value };
      onChange(filter);
    },
  };

  return (
    <Form className={"py-4"}>
      <Form.Group className="mb-3" controlId="loan-amount">
        <Form.Label>
          <small>Loan Amount</small>
        </Form.Label>
        <Form.Control
          onChange={(e) => {
            const value = e.target.value as number;
            const filter: LoanFilter = { type: LoanFilterType.AMOUNT, value };
            onChange(filter);
          }}
        />
      </Form.Group>
      <Form.Group className="mb-3" controlId="stable-coin">
        <Form.Label>
          <small>Stable coin</small>
        </Form.Label>
        <StableCoinDropdown
          coins={StableCoinHelper.all()}
          filter={true}
          onSelect={(value) => {
            const filter: LoanFilter = { type: LoanFilterType.STABLECOIN, value };
            onChange(filter);
          }}
        />
      </Form.Group>
      <Form.Group className="mb-3" controlId="ltv-slider">
        <Form.Label>
          <small>LTV ratio</small>
        </Form.Label>
        <Slider {...ltvSliderProps} />
      </Form.Group>
      <Form.Group className="mb-3" controlId="interest-slider">
        <Form.Label>
          <small>Interest rate p.a.</small>
        </Form.Label>
        <Slider {...interestSliderProps} />
      </Form.Group>
      <Form.Group className="mb-3" controlId="interest-slider">
        <Form.Label>
          <small>Period</small>
        </Form.Label>
        <Slider {...periodSliderProps} />
      </Form.Group>
    </Form>
  );
}

export default LoanOffersFilter;
