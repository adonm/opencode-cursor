export type LogLevel = "debug" | "info" | "warn" | "error";
export type ProviderLogger = (
	level: LogLevel,
	message: string,
	extra?: Record<string, unknown>,
) => void;

const LOGGER_KEY = Symbol.for("@oy-cli/opencode-cursor:logger");

type LoggerHolder = { [LOGGER_KEY]?: ProviderLogger };

/** Install a process-level provider logger for the embedding OpenCode adapter. */
export function setProviderLogger(logger: ProviderLogger | undefined): void {
	if (logger) (globalThis as LoggerHolder)[LOGGER_KEY] = logger;
	else delete (globalThis as LoggerHolder)[LOGGER_KEY];
}

export function getProviderLogger(): ProviderLogger | undefined {
	return (globalThis as LoggerHolder)[LOGGER_KEY];
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
): void {
	const logger = getProviderLogger();
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
