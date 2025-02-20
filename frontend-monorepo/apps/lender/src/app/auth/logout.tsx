import { useAuth } from "@frontend/http-client-lender";
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
      className="d-flex justify-content-center align-items-center"
      style={{ height: "100vh" }}
    >
      <Form
        className="p-4 rounded border"
        style={{ maxWidth: "400px", width: "100%" }}
      >
        <h1 className="text-center mb-4">Confirm Logout</h1>
        <p className="text-center">Are you sure you want to log out?</p>
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
