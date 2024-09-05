import { faTools } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export function Profile() {
  return (
    <div>
      <div className="d-flex flex-column justify-content-start align-items-center py-4">
        <FontAwesomeIcon icon={faTools} size="4x" className="text-warning mb-3" />
        <h3 className="text-muted">This is work in progress</h3>
      </div>
    </div>
  );
}

export default Profile;
