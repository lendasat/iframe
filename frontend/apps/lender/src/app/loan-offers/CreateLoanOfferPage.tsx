import { useWallet } from "@frontend/browser-wallet";
import {
  CreateLoanOfferRequest,
  LenderFeatureFlags,
  RepaymentPlan,
  useAuth,
  useLenderHttpClient,
} from "@frontend/http-client-lender";
import { LoanAsset, LoanPayout } from "@frontend/ui-shared";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CreateLoanOfferForm } from "./CreateLoanOfferForm";

export default function CreateLoanOfferPage() {
  const { getNpub, getPkAndDerivationPath } = useWallet();
  const { enabledFeatures } = useAuth();
  const navigate = useNavigate();
  const { postLoanOffer } = useLenderHttpClient();

  const autoApproveEnabled = enabledFeatures.includes(
    LenderFeatureFlags.AutoApproveLoanRequests,
  );
  const kycOffersEnabled = enabledFeatures.includes(
    LenderFeatureFlags.KycOffers,
  );

  const handleSubmit = async (data: CreateLoanOfferRequest) => {
    try {
      // Get wallet credentials
      const lender_npub = await getNpub();
      const lender_pk = await getPkAndDerivationPath();

      // Map to API request format
      const requestData: CreateLoanOfferRequest = {
        name: data.name,
        min_ltv: data.min_ltv / 100,
        interest_rate: data.interest_rate / 100,
        loan_amount_min: data.loan_amount_min,
        loan_amount_max: data.loan_amount_max,
        duration_days_min: data.duration_days_min,
        duration_days_max: data.duration_days_max,
        loan_asset: data.loan_asset as LoanAsset,
        loan_payout: data.loan_payout || LoanPayout.Direct,
        loan_repayment_address: data.loan_repayment_address,
        auto_accept: data.auto_accept,
        lender_npub: lender_npub,
        lender_pk: lender_pk.pubkey,
        lender_derivation_path: lender_pk.path,
        kyc_link: kycOffersEnabled && data.kyc_link ? data.kyc_link : undefined,
        extension_duration_days: data.extension_duration_days || 0,
        extension_interest_rate: data.extension_interest_rate
          ? data.extension_interest_rate / 100
          : 0,
        repayment_plan: data.repayment_plan as RepaymentPlan,
      };

      // Submit to API
      const res = await postLoanOffer(requestData);

      if (res !== undefined) {
        toast.success("Loan offer created successfully!", {
          description: "Redirecting to your offer details...",
        });

        // Navigate to the created offer
        setTimeout(() => {
          navigate(`/my-offers/${res.id}`);
        }, 1500);
      } else {
        throw new Error("Failed to create loan offer");
      }
    } catch (error) {
      console.error("Error creating loan offer:", error);
      toast.error("Failed to create loan offer", {
        description:
          error instanceof Error ? error.message : "Please try again",
      });
    }
  };

  return (
    <CreateLoanOfferForm
      onSubmit={handleSubmit}
      autoApproveEnabled={autoApproveEnabled}
      kycOffersEnabled={kycOffersEnabled}
    />
  );
}
