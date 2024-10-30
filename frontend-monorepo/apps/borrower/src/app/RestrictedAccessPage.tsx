import { FaArrowLeftLong } from "react-icons/fa6";
import { IoIosLock } from "react-icons/io";
import { Link } from "react-router-dom";

const RestrictedAccessPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="flex justify-center">
          <div className="bg-purple-100 p-6 rounded-full">
            <IoIosLock size={48} className="text-purple-600" />
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-gray-900">Access Restricted</h1>
          <p className="text-xl text-gray-600">
            You don't have access to this feature yet. If you want early access, please reach out to us via{" "}
            <Link className="text-font/70 hover:text-purple-800" to={"https://discord.gg/kyxqWFKMCF"} target={"_blank"}>
              Discord
            </Link>.
          </p>
        </div>

        <div className="relative w-full h-64 my-8">
          <svg viewBox="0 0 500 200" className="w-full h-full">
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
          onClick={() => window.history.back()}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
        >
          <FaArrowLeftLong size={16} className="mr-2" />
          Go Back
        </button>

        <p className="text-sm text-gray-500 mt-8">
          If you believe this is an error, please reach out to our support team.
        </p>
      </div>
    </div>
  );
};

export default RestrictedAccessPage;
