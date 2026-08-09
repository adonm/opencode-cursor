import { describe, expect, it, vi } from "vitest";
import {
  getProviderLogger,
  pluginLog,
  withProviderLogger,
} from "../src/provider/log-bridge.js";

describe("provider logger", () => {
  it("has no logger outside a provider operation", () => {
    expect(getProviderLogger()).toBeUndefined();
  });

  it("scopes a structured logger to one provider operation", () => {
    const logger = vi.fn();
    withProviderLogger(logger, () => {
      expect(getProviderLogger()).toBe(logger);
    });
    expect(getProviderLogger()).toBeUndefined();
  });

  it("isolates concurrent provider loggers", async () => {
    const first = vi.fn();
    const second = vi.fn();
    await Promise.all([
      withProviderLogger(first, async () => {
        await Promise.resolve();
        pluginLog("info", "first");
      }),
      withProviderLogger(second, async () => {
        await Promise.resolve();
        pluginLog("info", "second");
      }),
    ]);

    expect(first).toHaveBeenCalledWith("info", "first", undefined);
    expect(first).not.toHaveBeenCalledWith("info", "second", undefined);
    expect(second).toHaveBeenCalledWith("info", "second", undefined);
    expect(second).not.toHaveBeenCalledWith("info", "first", undefined);
  });
});

describe("pluginLog", () => {
  it("routes level, message, and metadata through the configured logger", () => {
    const logger = vi.fn();
    withProviderLogger(logger, () => {
      pluginLog("warn", "something degraded", { reason: "no sidecar" });
    });

    expect(logger).toHaveBeenCalledWith(
      "warn",
      "something degraded",
      { reason: "no sidecar" },
    );
  });

  it("omits metadata when not provided", () => {
    const logger = vi.fn();
    withProviderLogger(logger, () => {
      pluginLog("info", "no extras here");
    });

    expect(logger).toHaveBeenCalledWith("info", "no extras here", undefined);
  });

  it("swallows logger failures instead of failing the turn", () => {
    expect(() =>
      withProviderLogger(() => {
        throw new Error("logger failed");
      }, () => {
        pluginLog("error", "boom");
      }),
    ).not.toThrow();
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
