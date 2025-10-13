import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAsync } from "react-use";
import type { Route } from "./+types/register";
import { Button } from "~/components/ui/button";
import { LoadingOverlay } from "~/components/ui/spinner";
import { apiClient, UnauthorizedError } from "@repo/api";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Register - Lendasat" },
    { name: "description", content: "Register for Lendasat" },
  ];
}

export default function Register() {
  const navigate = useNavigate();
  // TODO: remove sample
  const [email, setEmail] = useState("test@test.com");
  const [username, setUsername] = useState(
    `Satoshi${Math.floor(Math.random() * 10000)}`,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Check if user is already authenticated
  // ApiProvider ensures API key is already set before this component renders
  const authCheck = useAsync(async () => {
    try {
      const me = await apiClient.me();
      localStorage.setItem("user", JSON.stringify(me));
      return me;
    } catch (error) {
      // User is not authenticated, which is expected on this page
      return null;
    }
  }, []);

  // Redirect to app if already authenticated
  useEffect(() => {
    if (authCheck.value && !authCheck.loading) {
      navigate("/app/contracts");
    }
  }, [authCheck.value, authCheck.loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    // Call API to register user
    try {
      await apiClient.register(email, username, "asd", "asd");
      const me = await apiClient.me();
      // TODO: do not store the whole user object in local storage
      localStorage.setItem("user", JSON.stringify(me));
      navigate("/app");
    } catch (error) {
      console.error("Failed registering", error);
      if (error instanceof UnauthorizedError) {
        setError("Authentication failed.");
      } else {
        setError("Failed to register. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading overlay while checking authentication
  if (authCheck.loading) {
    return <LoadingOverlay message="Checking authentication..." />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Welcome to Lendasat
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Register to get started
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-gray-700"
              >
                Username (optional)
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="text-red-600 text-sm text-center">{error}</div>
          )}

          <div>
            <Button
              variant={"default"}
              type="submit"
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? "Registering..." : "Register"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
