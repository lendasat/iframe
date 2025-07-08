import { useAuth } from "@frontend/http-client-borrower";
import { Button } from "@frontend/shadcn";
import { useNavigate } from "react-router-dom";

const Logout = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    logout();
    navigate("/");
  };
  const handleCancel = async () => {
    navigate("/");
  };

  return (
    <div className="dark:bg-dark flex h-screen items-center justify-center bg-white">
      <div
        className="dark:border-dark rounded border p-4"
        style={{ maxWidth: "400px", width: "100%" }}
      >
        <h1 className="text-font dark:text-font-dark mb-4 text-center">
          Confirm Logout
        </h1>
        <p className="text-font dark:text-font-dark text-center">
          Are you sure you want to log out? ???
        </p>
        <div className="d-flex justify-content-between">
          <Button
            variant="secondary"
            onClick={handleCancel}
            className="w-50 me-2 cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleLogout}
            className="w-50 cursor-pointer"
          >
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Logout;
