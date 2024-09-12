import { render } from "@testing-library/react";

import HttpClientLender from "./http-client-lender";

describe("HttpClientLender", () => {
  it("should render successfully", () => {
    const { baseElement } = render(<HttpClientLender />);
    expect(baseElement).toBeTruthy();
  });
});
