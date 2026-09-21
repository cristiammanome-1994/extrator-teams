import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("junta classes e resolve conflitos do Tailwind", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("a", false && "b", "c")).toBe("a c");
  });
});
