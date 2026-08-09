import { AsyncLocalStorage } from "node:async_hooks";

export type LogLevel = "debug" | "info" | "warn" | "error";
export type ProviderLogger = (
	level: LogLevel,
	message: string,
	extra?: Record<string, unknown>,
) => void;

const loggerContext = new AsyncLocalStorage<ProviderLogger>();

/** Run one provider operation with its own structured diagnostics sink. */
export function withProviderLogger<T>(
	logger: ProviderLogger | undefined,
	operation: () => T,
): T {
	return logger ? loggerContext.run(logger, operation) : operation();
}

export function getProviderLogger(): ProviderLogger | undefined {
	return loggerContext.getStore();
}

const SERVICE = "opencode-cursor";

/**
 * Best-effort structured logging. Embedders can install a logger without
 * pulling OpenCode SDK types into this provider-only package.
 */
export function pluginLog(
	level: LogLevel,
	message: string,
	extra?: Record<string, unknown>,
	logger = getProviderLogger(),
): void {
	if (logger) {
		try {
			logger(level, message, extra);
		} catch {
			// Diagnostics must never fail a model turn.
		}
		return;
	}
	if (level === "debug" && process.env["OPENCODE_CURSOR_DEBUG"] !== "1") return;
	const line = extra
		? `[${SERVICE}] ${message} ${JSON.stringify(extra)}`
		: `[${SERVICE}] ${message}`;
	switch (level) {
		case "debug":
			console.debug(line);
			break;
		case "info":
			console.info(line);
			break;
		case "warn":
			console.warn(line);
			break;
		case "error":
			console.error(line);
			break;
	}
}
