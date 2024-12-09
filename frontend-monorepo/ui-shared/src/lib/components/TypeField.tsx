import type { InputHTMLAttributes, ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  children?: ReactNode;
}

function TypeField({ children, ...rest }: InputProps) {
  return (
    <div className="flex flex-row items-center gap-2 px-3 h-11 border border-font/40 bg-white rounded-xl w-full dark:border-dark dark:bg-dark dark:text-white">
      <input
        className="focus:outline-none text-sm font-medium flex-grow placeholder:text-font/60 text-font bg-transparent dark:text-font-dark dark:placeholder:text-font-dark/60"
        {...rest}
      />
      {children}
    </div>
  );
}

export default TypeField;
