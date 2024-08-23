import { render } from "@testing-library/react";

import HttpClient from "./http-client";

describe("HttpClient", () => {
  it("should render successfully", () => {
    const { baseElement } = render(<HttpClient />);
    expect(baseElement).toBeTruthy();
  });
});
