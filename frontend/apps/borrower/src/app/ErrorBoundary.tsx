import { BiError } from "react-icons/bi";
import { Link, useNavigate } from "react-router-dom";

const ErrorBoundary = () => {
  const navigate = useNavigate();
  return (
    <div className="mt-5 flex justify-center">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center mb-4">
          <BiError size={80} color="#dc3545" />
        </div>
        <h2 className="mb-3 text-2xl font-bold">Oops! Something went wrong</h2>
        <p className="text-font dark:text-font-dark mb-4">
          {"We couldn't find what you were looking for."}
        </p>
        <Link to="/">
          <button
            type="button"
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            onClick={() => navigate("/")}
          >
            Home
          </button>
        </Link>
      </div>
    </div>
  );
};

export default ErrorBoundary;
