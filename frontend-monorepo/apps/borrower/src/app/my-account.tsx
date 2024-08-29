import { faEdit } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAuth } from "@frontend-monorepo/http-client";
import React, { useState } from "react";
import { Button, Spinner, Table } from "react-bootstrap";

function MyAccount() {
  const { user, forgotPassword } = useAuth();
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleResetPassword = async () => {
    setLoading(true);
    try {
      let successMsg = await forgotPassword(user?.email ?? "");
      setSuccess(successMsg);
    } catch (err) {
      console.error("Failed resetting password: ", err);
      setError(`Failed resetting password. ${err}`);
    }
    setLoading(false);
  };

  return (
    <>
      <h1>My Account</h1>
      {user
        ? (
          <div>
            <Table striped bordered hover responsive>
              <tbody>
                <tr>
                  <td className="font-weight-bold">Name</td>
                  <td>{user.name}</td>
                </tr>
                <tr>
                  <td className="font-weight-bold">Email</td>
                  <td>{user.email}</td>
                </tr>
                <tr>
                  <td className="font-weight-bold">Password</td>
                  <td className="d-flex justify-content-between align-items-center">
                    *******
                    <Button
                      variant="link"
                      className="p-0 m-0"
                      onClick={handleResetPassword}
                      disabled={isLoading}
                      title="Change Password"
                    >
                      {isLoading
                        ? (
                          <Spinner animation="border" role="status" variant="primary" size="sm">
                            <span className="visually-hidden">Loading...</span>
                          </Spinner>
                        )
                        : <FontAwesomeIcon icon={faEdit} color={"primary"} />}
                    </Button>
                  </td>
                </tr>
                <tr>
                  <td className="font-weight-bold">Joined</td>
                  <td>{new Date(user.created_at).toLocaleDateString()}</td>
                </tr>
              </tbody>
            </Table>

            {error && <div className="alert alert-danger">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}
          </div>
        )
        : <div>No user data found.</div>}
    </>
  );
}

export default MyAccount;
