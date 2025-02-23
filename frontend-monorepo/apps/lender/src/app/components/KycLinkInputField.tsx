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
          className="shadow-blackA4 hover:bg-violet3 mb-2 flex size-[25px] appearance-none items-center justify-center rounded bg-white shadow-[0_2px_10px] outline-none focus:shadow-[0_0_0_2px_black] dark:bg-gray-300"
          checked={isKycRequired}
          onCheckedChange={onCheckboxChange}
        >
          <Checkbox.Indicator className="text-violet11">
            <CheckIcon />
          </Checkbox.Indicator>
        </Checkbox.Root>
        <label
          className="dark:text-font-dark/60 pl-[15px] text-[15px]"
          htmlFor="c1"
        >
          Require KYC
        </label>
      </div>
      {isKycRequired && (
        <TextField.Root
          className="text-font dark:text-font-dark mt-2 flex w-full items-center border-0 font-semibold"
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
