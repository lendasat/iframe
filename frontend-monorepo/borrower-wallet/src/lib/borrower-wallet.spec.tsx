import { render } from "@testing-library/react";

import BorrowerWallet from "./borrower-wallet";

describe("BorrowerWallet", () => {
  it("should render successfully", () => {
    const { baseElement } = render(<BorrowerWallet />);
    expect(baseElement).toBeTruthy();
  });
});
