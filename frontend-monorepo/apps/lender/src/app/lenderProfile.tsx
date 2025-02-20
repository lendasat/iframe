import type { LenderStats } from "@lendasat/http-client-borrower";
import { useLenderHttpClient } from "@lendasat/http-client-lender";
import { UserStats } from "@lendasat/ui-shared";
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
