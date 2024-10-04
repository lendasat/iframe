import { InputHTMLAttributes, ReactNode } from "react";
import { BiSearchAlt } from "react-icons/bi";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  children?: ReactNode;
}

function TypeField({ children, ...rest }: InputProps) {
  return (
    <div className="flex flex-row items-center gap-2 px-3 h-11 border-1 border-font/40 bg-white rounded-xl w-full">
      <input
        className="focus:outline-none text-sm font-medium flex-grow placeholder:text-font-dark/60 text-font-dark bg-transparent"
        {...rest}
      />
      {children}
    </div>
  );
}

export default TypeField;
