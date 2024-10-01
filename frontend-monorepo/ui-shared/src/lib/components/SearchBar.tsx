import { InputHTMLAttributes, ReactNode } from "react";
import { BiSearchAlt } from "react-icons/bi";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  children?: ReactNode;
}

export default function SearchBar({ label, ...rest }: InputProps) {
  return (
    <div className="hidden md:flex flex-row items-center gap-2 px-2 h-9 border-1 border-white/70 bg-gradient-to-tr from-white/70 to-pink-800/[2%] backdrop-blur-lg rounded-lg max-w-xl w-full">
      <BiSearchAlt className="text-font/60" />
      <input
        className="focus:outline-none text-sm font-medium flex-grow text-font/60 bg-transparent"
        defaultValue={label}
        {...rest}
      />
    </div>
  );
}

export const InputField = ({ children, ...rest }: InputProps) => {
  return (
    <div className="flex flex-row items-center gap-2 px-3 h-11 border-1 border-font/40 bg-white rounded-xl max-w-xl w-full">
      <input
        className="focus:outline-none text-sm font-medium flex-grow placeholder:text-font-dark/85 text-font-dark bg-transparent"
        {...rest}
      />
      {children}
    </div>
  );
};
