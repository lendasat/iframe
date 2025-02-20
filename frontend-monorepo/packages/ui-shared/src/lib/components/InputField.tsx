import type { InputHTMLAttributes, ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  children?: ReactNode;
}

export function InputField({ children, ...rest }: InputProps) {
  return (
    <div className="flex flex-row items-center gap-2 px-3 h-11 border-1 border-font/40 bg-white rounded-xl max-w-xl w-full">
      <input
        className="focus:outline-none text-sm font-medium flex-grow placeholder:text-font-dark/85 text-font-dark bg-transparent"
        {...rest}
      />
      {children}
    </div>
  );
}
