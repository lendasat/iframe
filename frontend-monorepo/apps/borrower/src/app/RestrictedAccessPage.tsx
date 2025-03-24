import { FaArrowLeftLong } from "react-icons/fa6";
import { IoIosLock } from "react-icons/io";
import { Link } from "react-router-dom";

const RestrictedAccessPage = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b p-4">
      <div className="w-full max-w-2xl space-y-8 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-purple-100 p-6">
            <IoIosLock size={48} className="text-purple-600" />
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-font dark:text-font-dark text-4xl font-bold">
            Access Restricted
          </h1>
          <p className="text-font dark:text-font-dark text-xl">
            You do not have access to this feature yet. If you want early
            access, please reach out to us via{" "}
            <Link
              className="text-font/70 dark:text-font-dark/70 hover:text-purple-800 dark:hover:text-purple-300"
              to={"https://discord.gg/a5MP7yZDpQ"}
              target={"_blank"}
            >
              Discord
            </Link>
            .
          </p>
        </div>

        <div className="relative my-8 h-64 w-full">
          <svg viewBox="0 0 500 200" className="h-full w-full">
            <title>Circles</title>
            <path
              d="M30,100 Q150,50 250,100 T470,100"
              fill="none"
              stroke="#C4B5FD"
              strokeWidth="2"
            />
            <circle cx="250" cy="100" r="40" fill="#7C3AED" opacity="0.2" />
            <circle cx="250" cy="100" r="30" fill="#7C3AED" opacity="0.3" />
            <circle cx="250" cy="100" r="20" fill="#7C3AED" opacity="0.4" />
            <circle cx="250" cy="100" r="10" fill="#7C3AED" />
          </svg>
        </div>

        <button
          type="button"
          onClick={() => window.history.back()}
          className="inline-flex items-center rounded-lg bg-purple-50 px-4 py-2 text-sm font-medium text-purple-600 transition-colors hover:bg-purple-100 dark:bg-purple-700 dark:text-purple-300 dark:hover:bg-purple-600"
        >
          <FaArrowLeftLong size={16} className="mr-2" />
          Go Back
        </button>

        <p className="text-font dark:text-font-dark mt-8 text-sm">
          If you believe this is an error, please reach out to our support team.
        </p>
      </div>
    </div>
  );
};

export default RestrictedAccessPage;
