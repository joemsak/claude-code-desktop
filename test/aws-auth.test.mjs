import { describe, it, expect, beforeEach, vi } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { createAwsAuth } = require("../src/main/aws-auth");

describe("aws-auth", () => {
  let mockExec, auth;

  beforeEach(() => {
    mockExec = vi.fn();
    auth = createAwsAuth(mockExec);
  });

  it("checks AWS auth with sts get-caller-identity", () => {
    auth.ensureAuth({ AWS_PROFILE: "test-profile" });
    expect(mockExec).toHaveBeenCalledWith(
      expect.stringContaining("aws sts get-caller-identity --profile test-profile"),
      expect.any(Object),
    );
  });

  it("runs sso login if sts check fails", () => {
    mockExec
      .mockImplementationOnce(() => { throw new Error("expired"); })
      .mockImplementationOnce(() => {});
    auth.ensureAuth({ AWS_PROFILE: "test-profile" });
    expect(mockExec).toHaveBeenCalledTimes(2);
    expect(mockExec.mock.calls[1][0]).toContain("aws sso login");
  });

  it("only checks auth once", () => {
    auth.ensureAuth({ AWS_PROFILE: "test-profile" });
    auth.ensureAuth({ AWS_PROFILE: "test-profile" });
    expect(mockExec).toHaveBeenCalledTimes(1);
  });

  it("defaults to bedrock-users profile", () => {
    auth.ensureAuth({});
    expect(mockExec.mock.calls[0][0]).toContain("bedrock-users");
  });

  it("rejects invalid profile names", () => {
    auth.ensureAuth({ AWS_PROFILE: "foo; rm -rf /" });
    expect(mockExec).not.toHaveBeenCalled();
  });

  it("still returns without throwing if both checks fail", () => {
    mockExec.mockImplementation(() => { throw new Error("fail"); });
    expect(() => auth.ensureAuth({ AWS_PROFILE: "test" })).not.toThrow();
  });
});
