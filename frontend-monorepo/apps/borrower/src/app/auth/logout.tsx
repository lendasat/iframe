import { useAuth } from "@frontend/http-client-borrower";
import { Button, Container, Form } from "react-bootstrap";
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
    <Container
      className="d-flex justify-content-center align-items-center dark:bg-dark bg-white"
      style={{ height: "100vh" }}
    >
      <Form
        className="dark:border-dark rounded border p-4"
        style={{ maxWidth: "400px", width: "100%" }}
      >
        <h1 className="text-font dark:text-font-dark mb-4 text-center">
          Confirm Logout
        </h1>
        <p className="text-font dark:text-font-dark text-center">
          Are you sure you want to log out?
        </p>
        <div className="d-flex justify-content-between">
          <Button
            variant="secondary"
            onClick={handleCancel}
            className="w-50 me-2"
          >
            Cancel
          </Button>
          <Button variant="danger" onClick={handleLogout} className="w-50">
            Logout
          </Button>
        </div>
      </Form>
    </Container>
  );
};

export default Logout;
