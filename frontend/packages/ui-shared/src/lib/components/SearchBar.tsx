import type { InputHTMLAttributes, ReactNode } from "react";
import { BiSearchAlt } from "react-icons/bi";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  children?: ReactNode;
}

export const SearchBar = ({ label, ...rest }: InputProps) => {
  return (
    <div className="border-1 hidden h-9 w-full max-w-xl flex-row items-center gap-2 rounded-lg border-white/70 bg-gradient-to-tr from-white/70 to-pink-800/[2%] px-2 backdrop-blur-lg md:flex">
      <BiSearchAlt className="text-font/60" />
      <input
        className="text-font/60 flex-grow bg-transparent text-sm font-medium focus:outline-none"
        defaultValue={label}
        {...rest}
      />
    </div>
  );
};
