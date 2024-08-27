import { useParams } from "react-router-dom";

export function Profile() {
  const { id } = useParams();

  return (
    <div>
      <h3>User profile: {id}</h3>
    </div>
  );
}

export default Profile;
