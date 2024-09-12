import { faEdit } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useBaseHttpClient } from "@frontend-monorepo/base-http-client";
import { useAuth } from "@frontend-monorepo/http-client-borrower";
import React, { useEffect, useState } from "react";
import { Button, Spinner, Table } from "react-bootstrap";
import { FaEye } from "react-icons/fa";
import { FaEyeSlash } from "react-icons/fa6";
import init, {
  does_wallet_exist,
  get_mnemonic,
  is_wallet_loaded,
} from "../../../../../borrower-wallet/pkg/borrower_wallet.js";
import { CreateWalletModal } from "./wallet/create-wallet-modal";
import { UnlockWalletModal } from "./wallet/unlock-wallet-modal";

function MyAccount() {
  const { user } = useAuth();
  const { forgotPassword } = useBaseHttpClient();
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function initializeWasm() {
      await init();
    }

    initializeWasm();
  }, []); // Empty dependency array means this runs once on mount

  const handleResetPassword = async () => {
    setLoading(true);
    try {
      const successMsg = await forgotPassword(user?.email ?? "");
      setSuccess(successMsg);
    } catch (err) {
      console.error("Failed resetting password: ", err);
      setError(`Failed resetting password. ${err}`);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col md:flex-row gap-8">
      <div className="md:w-1/2">
        <h1 className="text-2xl font-bold mb-4">My Account</h1>
        {user
          ? (
            <div>
              <Table>
                <tbody>
                  <tr>
                    <td className="font-bold">Name</td>
                    <td>{user.name}</td>
                  </tr>
                  <tr>
                    <td className="font-bold">Email</td>
                    <td>{user.email}</td>
                  </tr>
                  <tr>
                    <td className="font-bold">Password</td>
                    <td className="flex justify-between items-center">
                      *******
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleResetPassword}
                        disabled={isLoading}
                        title="Change Password"
                      >
                        {isLoading
                          ? <Spinner className="h-4 w-4" />
                          : <FontAwesomeIcon icon={faEdit} className="text-blue-500" />}
                      </Button>
                    </td>
                  </tr>
                  <tr>
                    <td className="font-bold">Joined</td>
                    <td>{new Date(user.created_at).toLocaleDateString()}</td>
                  </tr>
                </tbody>
              </Table>
              {error && (
                <div
                  className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mt-4"
                  role="alert"
                >
                  {error}
                </div>
              )}
              {success
                && (
                  <div
                    className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mt-4"
                    role="alert"
                  >
                    {success}
                  </div>
                )}
            </div>
          )
          : <div>No user data found.</div>}
      </div>

      <MnemonicDisplay />
    </div>
  );
}

const MnemonicDisplay = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [showCreateWalletModal, setShowCreateWalletModal] = useState(false);
  const [showUnlockWalletModal, setShowUnlockWalletModal] = useState(false);
  const [mnemonic, setMnemonic] = useState("");

  useEffect(() => {
    async function initializeWasm() {
      await init();
    }

    initializeWasm();
  }, []);

  const onEyeButtonClick = async () => {
    await init();

    const walletExists = does_wallet_exist();
    const isLoaded = is_wallet_loaded();
    if (!walletExists) {
      handleOpenCreateWalletModal();
      return;
    }
    if (!isLoaded) {
      handleOpenUnlockWalletModal();
      return;
    }

    if (isLoaded && !isVisible) {
      await handleGetMnemonic();
    }
    setIsVisible(!isVisible);
  };

  const handleGetMnemonic = async () => {
    try {
      const isLoaded = is_wallet_loaded();
      if (isLoaded) {
        const mnemonicValue = get_mnemonic();
        setMnemonic(mnemonicValue);
      }
    } catch (e) {
      alert(e);
    }
  };

  const handleCloseCreateWalletModal = () => setShowCreateWalletModal(false);
  const handleOpenCreateWalletModal = () => setShowCreateWalletModal(true);

  const handleCloseUnlockWalletModal = () => setShowUnlockWalletModal(false);
  const handleOpenUnlockWalletModal = () => setShowUnlockWalletModal(true);
  const handleSubmitCreateWalletModal = async () => {
    handleCloseCreateWalletModal();
    await handleGetMnemonic();
  };
  const handleSubmitUnlockWalletModal = async () => {
    handleCloseUnlockWalletModal();
    await handleGetMnemonic();
  };

  return (
    <div className="md:w-1/2">
      <h2 className="text-2xl font-bold mb-4">Seed phrase</h2>
      <div className="space-y-4">
        <div className="bg-white shadow rounded-lg p-4">
          <CreateWalletModal
            show={showCreateWalletModal}
            handleClose={handleCloseCreateWalletModal}
            handleSubmit={handleSubmitCreateWalletModal}
          />
          <UnlockWalletModal
            show={showUnlockWalletModal}
            handleClose={handleCloseUnlockWalletModal}
            handleSubmit={handleSubmitUnlockWalletModal}
          />
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold">Mnemonic Seed Phrase</h3>
            <button
              onClick={onEyeButtonClick}
              className="text-gray-600 hover:text-gray-800 focus:outline-none"
              aria-label={isVisible ? "Hide mnemonic" : "Show mnemonic"}
            >
              {isVisible ? <FaEyeSlash className="w-5 h-5" /> : <FaEye className="w-5 h-5" />}
            </button>
          </div>
          <div className="bg-gray-100 p-3 rounded">
            {isVisible
              ? <p className="break-all">{mnemonic}</p>
              : <p className="text-gray-500">● ● ● ● ● ● ● ● ● ● ● ●</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyAccount;
