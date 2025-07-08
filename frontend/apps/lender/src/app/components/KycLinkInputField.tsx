import { ChangeEvent } from "react";
import { Checkbox } from "@frontend/shadcn";
import { Input } from "@frontend/shadcn";
import { Label } from "@frontend/shadcn";

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

  function onCheckboxChange(checked: boolean) {
    setIsKycRequired(checked);

    if (!checked) {
      setLink("");
    }
  }

  return (
    <div className="flex flex-col space-y-2">
      <div className="flex items-center space-x-2">
        <Checkbox
          id="kyc-required"
          checked={isKycRequired}
          onCheckedChange={onCheckboxChange}
        />
        <Label
          htmlFor="kyc-required"
          className="text-sm font-normal text-muted-foreground"
        >
          Require KYC
        </Label>
      </div>

      {isKycRequired && (
        <Input
          className="mt-2 w-full"
          placeholder="Enter KYC link"
          type="url"
          value={link}
          onChange={onInputChange}
        />
      )}
    </div>
  );
}
