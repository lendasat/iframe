import { useAuth, User } from "@frontend-monorepo/http-client";
import { useEffect, useState } from "react";

function MyAccount() {
  const { user } = useAuth();

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
