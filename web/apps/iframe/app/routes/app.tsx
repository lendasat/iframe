import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import type { Route } from "./+types/app";
import { ContractsTab } from "~/components/ContractsTab";
import { OffersTab } from "~/components/OffersTab";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Lendasat" },
    { name: "description", content: "Lendasat lending platform" },
  ];
}

type Tab = "contracts" | "offers" | "applications";

export default function App() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("contracts");
  const [user, setUser] = useState<{ email: string; username: string } | null>(
    null,
  );

  useEffect(() => {
    // Check if user is registered
    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
      navigate("/");
      return;
    }
    setUser(JSON.parse(storedUser));
  }, [navigate]);

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold text-gray-900">Lendasat</h1>
            <div className="text-sm text-gray-600">
              <span className="font-medium">{user.username}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {activeTab === "contracts" && <ContractsTab user={user} />}

        {activeTab === "offers" && <OffersTab user={user} />}

        {activeTab === "applications" && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              My Applications
            </h2>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600">
                Your loan applications will appear here.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-around">
            <button
              onClick={() => setActiveTab("contracts")}
              className={`flex-1 flex flex-col items-center py-3 px-2 text-sm font-medium transition-colors ${
                activeTab === "contracts"
                  ? "text-indigo-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <svg
                className="w-6 h-6 mb-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>Contracts</span>
            </button>

            <button
              onClick={() => setActiveTab("offers")}
              className={`flex-1 flex flex-col items-center py-3 px-2 text-sm font-medium transition-colors ${
                activeTab === "offers"
                  ? "text-indigo-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <svg
                className="w-6 h-6 mb-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              <span>Offers</span>
            </button>

            <button
              onClick={() => setActiveTab("applications")}
              className={`flex-1 flex flex-col items-center py-3 px-2 text-sm font-medium transition-colors ${
                activeTab === "applications"
                  ? "text-indigo-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <svg
                className="w-6 h-6 mb-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <span>Applications</span>
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
}
