import {
  LenderStats,
  useBorrowerHttpClient,
} from "@frontend-monorepo/http-client-borrower";
import { UserStats } from "@frontend-monorepo/ui-shared";
import { Suspense } from "react";
import { Await, useParams } from "react-router-dom";

export function LenderProfile() {
  const { id } = useParams();
  const { getLenderProfile } = useBorrowerHttpClient();

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
          <UserStats
            id={profile.id}
            name={profile.name}
            successful_contracts={profile.successful_contracts}
            failed_contracts={profile.failed_contracts}
            rating={profile.rating}
            joined_at={profile.joined_at}
            timezone={profile.timezone}
          />
        )}
      />
    </Suspense>
  );
}

export default LenderProfile;
