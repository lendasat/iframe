import {
  useLenderHttpClient,
  BorrowerStats,
} from "@frontend/http-client-lender";
import { UserStatsPage } from "@frontend/ui-shared";
import { Suspense } from "react";
import { Await, useParams } from "react-router-dom";

export function LenderProfile() {
  const { id } = useParams();
  const { getLenderProfile } = useLenderHttpClient();

  return (
    <Suspense>
      <Await
        resolve={id ? getLenderProfile(id) : null}
        errorElement={
          <div className={"text-font dark:text-font-dark"}>
            Could not load profile
          </div>
        }
        children={(profile: Awaited<BorrowerStats>) => (
          <UserStatsPage
            id={profile.id}
            name={profile.name}
            successful_contracts={profile.successful_contracts}
            joined_at={profile.joined_at}
            timezone={profile.timezone}
            userType={"borrower"}
          />
        )}
      />
    </Suspense>
  );
}

export default LenderProfile;
