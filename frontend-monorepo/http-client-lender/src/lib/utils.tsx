// Helper function to parse RFC3339 dates
export const parseRFC3339Date = (dateString: string | undefined): Date | undefined => {
  if (dateString === undefined || dateString === "") {
    return undefined;
  }
  return new Date(dateString);
};
