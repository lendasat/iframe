import { useAuth, User } from "@frontend-monorepo/http-client";
import { useEffect, useState } from "react";

function MyAccount() {
  const { me } = useAuth();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setLoading(true);
        const userData = await me();
        setUser(userData || null);
      } catch (err) {
        setError("Failed to load user data.");
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [me]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <>
      <h1>My Account</h1>
      {user
        ? (
          <div>
            <p>Name: {user.name}</p>
            <p>Email: {user.email}</p>
            <p>Verified: {user.verified ? "Yes" : "No"}</p>
            <p>Joined: {new Date(user.created_at).toLocaleDateString()}</p>
          </div>
        )
        : <div>No user data found.</div>}
    </>
  );
}

export default MyAccount;
