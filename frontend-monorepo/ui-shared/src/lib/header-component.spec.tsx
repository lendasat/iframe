import { render } from "@testing-library/react";

import HeaderComponent from "./header-component";

describe("HeaderComponent", () => {
  it("should render successfully", () => {
    const { baseElement } = render(<HeaderComponent title={"Foo"} />);
    expect(baseElement).toBeTruthy();
  });
});
