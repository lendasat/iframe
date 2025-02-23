import type { InputHTMLAttributes, ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  children?: ReactNode;
}

function TypeField({ children, ...rest }: InputProps) {
  return (
    <div className="border-font/40 dark:border-dark dark:bg-dark flex h-11 w-full flex-row items-center gap-2 rounded-xl border bg-white px-3 dark:text-white">
      <input
        className="placeholder:text-font/60 text-font dark:text-font-dark dark:placeholder:text-font-dark/60 flex-grow bg-transparent text-sm font-medium focus:outline-none"
        {...rest}
      />
      {children}
    </div>
  );
}

export default TypeField;
