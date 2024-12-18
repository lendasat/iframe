import { render } from "@testing-library/react";
import { WalletProvider } from "./browser-wallet";

describe("BrowserWallet", () => {
  it("should render successfully", () => {
    const { baseElement } = render(<WalletProvider children={""} email="borrower@lendasat.com" />);
    expect(baseElement).toBeTruthy();
  });
});
