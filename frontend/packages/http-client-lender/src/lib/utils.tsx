// Helper function to parse RFC3339 dates
export const parseRFC3339Date = (
  dateString: string | undefined,
): Date | undefined => {
  if (dateString === undefined || dateString === "") {
    return undefined;
  }
  return new Date(dateString);
};

export const isAllowedPageWithoutLogin = (path: string) => {
  return (
    path.includes("login") ||
    path.includes("registration") ||
    path.includes("forgotpassword") ||
    path.includes("resetpassword") ||
    path.includes("verifyemail") ||
    path.includes("logout") ||
    path.includes("error") ||
    path.includes("waitlist")
  );
};
