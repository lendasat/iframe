import { InputHTMLAttributes } from "react";
import { BiSearchAlt } from "react-icons/bi";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
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
