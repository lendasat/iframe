import * as Checkbox from "@radix-ui/react-checkbox";
import { CheckIcon } from "@radix-ui/react-icons";
import { TextField } from "@radix-ui/themes";
import type { ChangeEvent } from "react";

interface KycLinkInputFieldProps {
  isKycRequired: boolean;
  setIsKycRequired: (value: boolean) => void;
  link: string;
  setLink: (value: string) => void;
}

export function KycLinkInputField({
  link,
  setLink,
  isKycRequired,
  setIsKycRequired,
}: KycLinkInputFieldProps) {
  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    setLink(e.target.value);
  }

  function onCheckboxChange(state: boolean) {
    setIsKycRequired(state);

    if (!state) {
      setLink("");
    }
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center">
        <Checkbox.Root
          className="flex size-[25px] appearance-none items-center justify-center rounded bg-white dark:bg-gray-300 shadow-[0_2px_10px] shadow-blackA4 outline-none hover:bg-violet3 focus:shadow-[0_0_0_2px_black] mb-2"
          checked={isKycRequired}
          onCheckedChange={onCheckboxChange}
        >
          <Checkbox.Indicator className="text-violet11">
            <CheckIcon />
          </Checkbox.Indicator>
        </Checkbox.Root>
        <label
          className="pl-[15px] text-[15px] dark:text-font-dark/60"
          htmlFor="c1"
        >
          Require KYC
        </label>
      </div>
      {isKycRequired && (
        <TextField.Root
          className="w-full font-semibold border-0 flex items-center text-font dark:text-font-dark mt-2"
          size={"3"}
          variant="surface"
          placeholder="Enter KYC link"
          type="url"
          value={link}
          onChange={onInputChange}
        />
      )}
    </div>
  );
}
