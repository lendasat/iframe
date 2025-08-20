import {
  LenderStats,
  useHttpClientBorrower,
} from "@frontend/http-client-borrower";
import { UserStatsPage } from "@frontend/ui-shared";
import { Suspense } from "react";
import { Await, useParams } from "react-router-dom";

export function LenderProfile() {
  const { id } = useParams();
  const { getLenderProfile } = useHttpClientBorrower();

  return (
    <Suspense>
      <Await
        resolve={id ? getLenderProfile(id) : null}
        errorElement={
          <div className={"text-font dark:text-font-dark"}>
            Could not load profile
          </div>
        }
        children={(profile: Awaited<LenderStats>) => (
          <UserStatsPage
            id={profile.id}
            name={profile.name}
            successful_contracts={profile.successful_contracts}
            joined_at={profile.joined_at}
            timezone={profile.timezone}
            userType={"lender"}
            vetted={profile.vetted}
          />
        )}
      />
    </Suspense>
  );
}

export default LenderProfile;
