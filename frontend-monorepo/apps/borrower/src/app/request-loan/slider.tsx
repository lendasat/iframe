import React, { useState } from "react";
import { Form } from "react-bootstrap";

export interface SliderProps {
  min: number;
  max: number;
  init: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void;
}

export const Slider = ({ min, max, init, step, suffix, onChange }: SliderProps) => {
  const [value, setValue] = useState(init);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value); // Convert string to number
    setValue(newValue);
    onChange(newValue);
  };

  return (
    <div>
      <div className="text-center">
        <span>
          <small>{value}{suffix}</small>
        </span>
      </div>
      <Form.Range
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleChange}
        className="mb-0"
      />
      <div className="d-flex justify-content-between">
        <span>
          <small>{min}{suffix}</small>
        </span>
        <span>
          <small>{max}{suffix}</small>
        </span>
      </div>
    </div>
  );
};

export default Slider;
