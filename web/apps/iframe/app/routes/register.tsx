import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAsync } from "react-use";
import type { Route } from "./+types/register";
import { Button } from "~/components/ui/button";
import { LoadingOverlay } from "~/components/ui/spinner";
import { apiClient, UnauthorizedError } from "@repo/api";
import { useWallet } from "~/hooks/useWallet";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Register - Lendasat" },
    { name: "description", content: "Register for Lendasat" },
  ];
}

export default function Register() {
  const navigate = useNavigate();
  const { client } = useWallet();
  // TODO: remove sample
  const [email, setEmail] = useState("test@test.com");
  const [username, setUsername] = useState(
    `Satoshi${Math.floor(Math.random() * 10000)}`,
  );
  const [inviteCode, setInviteCode] = useState("");
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

    if (!client) {
      setError("Wallet not connected");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // Get public key from wallet
      const pubkey = await client.getPublicKey();
      console.log(`Registering with pubkey: ${pubkey}`);

      // Get challenge from server
      const { challenge } = await apiClient.getRegisterChallenge(pubkey);
      console.log(`Challenge received: ${challenge}`);

      // Sign the challenge using the wallet
      const signature = await client.signMessage(challenge);
      console.log(`Challenge signed: ${signature.substring(0, 20)}...`);

      // Register user with pubkey
      const { userId } = await apiClient.register({
        name: username,
        email,
        pubkey,
        inviteCode: inviteCode || null,
      });
      console.log(`User registered: ${userId}`);

      // Login to get JWT token
      const response = await apiClient.login({ pubkey, challenge, signature });
      console.log("Login successful!");

      // Set the JWT token for authenticated requests
      apiClient.setToken(response.token);

      // Store user info
      localStorage.setItem("user", JSON.stringify(response.user));

      // Navigate to app
      navigate("/app/contracts");
    } catch (error) {
      console.error("Failed registering", error);
      if (error instanceof UnauthorizedError) {
        setError("Authentication failed.");
      } else {
        setError(
          `Failed to register: ${error instanceof Error ? error.message : String(error)}`,
        );
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
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor="inviteCode"
                className="block text-sm font-medium text-gray-700"
              >
                Invite Code (optional)
              </label>
              <input
                id="inviteCode"
                name="inviteCode"
                type="text"
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Enter invite code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
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
