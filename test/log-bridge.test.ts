import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getProviderLogger,
  pluginLog,
  setProviderLogger,
} from "../src/provider/log-bridge.js";

afterEach(() => {
  setProviderLogger(undefined);
});

describe("provider logger", () => {
  it("has no logger until configured", () => {
    expect(getProviderLogger()).toBeUndefined();
  });

  it("stores and clears a structured logger", () => {
    const logger = vi.fn();
    setProviderLogger(logger);
    expect(getProviderLogger()).toBe(logger);
    setProviderLogger(undefined);
    expect(getProviderLogger()).toBeUndefined();
  });
});

describe("pluginLog", () => {
  it("routes level, message, and metadata through the configured logger", () => {
    const logger = vi.fn();
    setProviderLogger(logger);

    pluginLog("warn", "something degraded", { reason: "no sidecar" });

    expect(logger).toHaveBeenCalledWith(
      "warn",
      "something degraded",
      { reason: "no sidecar" },
    );
  });

  it("omits metadata when not provided", () => {
    const logger = vi.fn();
    setProviderLogger(logger);

    pluginLog("info", "no extras here");

    expect(logger).toHaveBeenCalledWith("info", "no extras here", undefined);
  });

  it("swallows logger failures instead of failing the turn", () => {
    setProviderLogger(() => {
      throw new Error("logger failed");
    });

    expect(() => pluginLog("error", "boom")).not.toThrow();
  });

  it("falls back to console.* when no bridge is published", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    pluginLog("warn", "standalone warning", { foo: "bar" });
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("[opencode-cursor] standalone warning"),
    );
    spy.mockRestore();
  });
});
