import { describe, it, expect } from "vitest";
import { resolveGoogleClientId } from "./config.js";

const ENV = "env-id.apps.googleusercontent.com";

describe("resolveGoogleClientId", () => {
  it("falls back to the deployment env value when no override is set", () => {
    expect(resolveGoogleClientId({}, ENV)).toBe(ENV);
    expect(resolveGoogleClientId({ googleClientId: "" }, ENV)).toBe(ENV);
    expect(resolveGoogleClientId(null, ENV)).toBe(ENV);
  });

  it("treats a whitespace-only override as unset", () => {
    expect(resolveGoogleClientId({ googleClientId: "   " }, ENV)).toBe(ENV);
  });

  it("lets an explicit Settings override win over the env value", () => {
    expect(resolveGoogleClientId({ googleClientId: "local-id" }, ENV)).toBe("local-id");
  });

  it("trims the override", () => {
    expect(resolveGoogleClientId({ googleClientId: "  local-id  " }, ENV)).toBe("local-id");
  });

  it("returns empty string when neither is configured", () => {
    expect(resolveGoogleClientId({}, "")).toBe("");
  });
});
