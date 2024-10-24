import { faTools } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { LenderProfile } from "@frontend-monorepo/http-client-borrower";
import { useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import { Suspense } from "react";
import { Await, useParams } from "react-router-dom";

export function Profile() {
  const { id } = useParams();
  const { getLenderProfile } = useBorrowerHttpClient();

  return (
    <Suspense>
      <Await
        resolve={async () => {
          if (id == null) {
            return Promise.reject(new Error("Cannot load profile without ID"));
          }
          return getLenderProfile(id);
        }}
        errorElement={<div>Could not load profile</div>}
        children={(profile: Awaited<LenderProfile>) => (
          <div>
            <div className="d-flex flex-column justify-content-start align-items-center py-4">
              <FontAwesomeIcon icon={faTools} size="4x" className="text-warning mb-3" />
              <h3 className="text-muted">{profile.name}</h3>
            </div>
          </div>
        )}
      />
    </Suspense>
  );
}

export default Profile;
