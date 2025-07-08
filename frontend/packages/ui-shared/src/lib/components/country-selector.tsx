import { useEffect, useState } from "react";
import countries from "i18n-iso-countries";
import english from "i18n-iso-countries/langs/en.json";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@frontend/shadcn";

// Register the English locale
countries.registerLocale(english);

interface CountrySelectorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  triggerClassName?: string;
  contentClassName?: string;
  useCountryNameAsValue?: boolean;
}

const CountrySelector: React.FC<CountrySelectorProps> = ({
  value,
  onChange,
  placeholder = "Select Country",
  triggerClassName = "w-[150px]",
  contentClassName = "overflow-y-auto max-h-[10rem]",
  useCountryNameAsValue = false,
}) => {
  const [countryCodes, setCountryCodes] = useState<string[]>([]);

  useEffect(() => {
    // Get all alpha-2 country codes
    const codes = Object.keys(countries.getAlpha2Codes());

    // Sort the country codes by their English names
    codes.sort((a, b) => {
      const nameA = countries.getName(a, "en") || "";
      const nameB = countries.getName(b, "en") || "";
      return nameA.localeCompare(nameB);
    });

    setCountryCodes(codes);
  }, []);

  return (
    <Select onValueChange={onChange} defaultValue={value}>
      <SelectTrigger className={triggerClassName}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {countryCodes.map((code) => {
          const countryName = countries.getName(code, "en");
          if (!countryName) {
            return null;
          }
          return (
            <SelectItem
              key={code}
              value={useCountryNameAsValue ? countryName : code}
            >
              {countryName}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
};

export default CountrySelector;
