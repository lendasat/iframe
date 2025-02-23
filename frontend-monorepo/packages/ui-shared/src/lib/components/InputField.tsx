import type { InputHTMLAttributes, ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  children?: ReactNode;
}

export function InputField({ children, ...rest }: InputProps) {
  return (
    <div className="border-1 border-font/40 flex h-11 w-full max-w-xl flex-row items-center gap-2 rounded-xl bg-white px-3">
      <input
        className="placeholder:text-font-dark/85 text-font-dark flex-grow bg-transparent text-sm font-medium focus:outline-none"
        {...rest}
      />
      {children}
    </div>
  );
}
