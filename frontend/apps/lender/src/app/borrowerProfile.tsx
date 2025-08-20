import {
  BorrowerStats,
  useLenderHttpClient,
} from "@frontend/http-client-lender";
import { UserStatsPage } from "@frontend/ui-shared";
import { Suspense } from "react";
import { Await, useParams } from "react-router-dom";

export function BorrowerProfile() {
  const { id } = useParams();
  const { getBorrowerProfile } = useLenderHttpClient();

  return (
    <Suspense>
      <Await
        resolve={id ? getBorrowerProfile(id) : null}
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

export default BorrowerProfile;
