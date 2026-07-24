import type { OpencodeClient } from "@opencode-ai/sdk";

/**
 * Bridge from the opencode plugin to the provider stream layer.
 *
 * A Cursor subagent runs entirely inside Cursor's process — no opencode child
 * session exists, so its `task` card is dead (not clickable, `ctrl+x down`
 * navigates nowhere). To make it native, the provider must create a REAL
 * opencode child session (`Session.parentID`) and point the task part's
 * `state.metadata.sessionId` at it.
 *
 * The provider stream code ({@link cursorEventsToStream}) has no opencode
 * client. The plugin does (`PluginInput.client` + `directory`). They run in the
 * same process, so the plugin publishes them here on a `globalThis` registry
 * (immune to bundler entry-point splitting) and the provider reads them lazily.
 * When the bridge is absent (provider used without the plugin, or client
 * unavailable), subagent linking is skipped and the card degrades to exactly
 * its previous non-navigable behavior.
 */
export interface SubagentBridge {
	client: OpencodeClient;
	/** Workspace directory threaded into session create/prompt calls. */
	directory?: string;
}

const BRIDGE_KEY = Symbol.for("@stablekernel/opencode-cursor:subagent-bridge");

type BridgeHolder = { [BRIDGE_KEY]?: SubagentBridge };

/** Publish the opencode client + directory for the provider to use. */
export function setSubagentBridge(bridge: SubagentBridge): void {
	(globalThis as BridgeHolder)[BRIDGE_KEY] = bridge;
}

/** Drop the bridge (plugin dispose). */
export function clearSubagentBridge(): void {
	delete (globalThis as BridgeHolder)[BRIDGE_KEY];
}

/** Read the current bridge, or `undefined` when the plugin hasn't published one. */
export function getSubagentBridge(): SubagentBridge | undefined {
	return (globalThis as BridgeHolder)[BRIDGE_KEY];
}

function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null;
}

function strField(v: unknown, key: string): string | undefined {
	return isRecord(v) && typeof v[key] === "string"
		? (v[key] as string)
		: undefined;
}

function numField(v: unknown, key: string): number | undefined {
	return isRecord(v) && typeof v[key] === "number"
		? (v[key] as number)
		: undefined;
}

/** Format a millisecond duration the way opencode's TUI does (ms / s / m). */
function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
	const minutes = Math.floor(ms / 60000);
	const seconds = Math.floor((ms % 60000) / 1000);
	return `${minutes}m ${seconds}s`;
}

/**
 * A compact activity line ("ran 5 steps in 12.3s") built from Cursor's task
 * result. `conversationSteps` is opaquely typed, so it's reported as a step
 * count (an honest proxy) rather than claiming an exact tool-call count.
 * Returns `undefined` when neither timing nor steps are available.
 */
function activityLine(value: unknown): string | undefined {
	const durationMs = numField(value, "durationMs");
	const steps =
		isRecord(value) && Array.isArray(value["conversationSteps"])
			? (value["conversationSteps"] as unknown[]).length
			: undefined;
	const bits: string[] = [];
	if (steps && steps > 0) bits.push(`${steps} step${steps === 1 ? "" : "s"}`);
	if (typeof durationMs === "number") bits.push(`in ${formatDuration(durationMs)}`);
	return bits.length > 0 ? `_Subagent ran ${bits.join(" ")}._` : undefined;
}

/**
 * Cursor's proto zero-value subagent kind. Never forward it: the TUI would
 * titlecase it to "Unspecified", and it's meaningless as an agent label.
 */
const UNSPECIFIED_KIND = "unspecified";

/**
 * Resolve a human agent label from Cursor's `subagentType` ({ kind, name? }).
 * Prefers a real `name`; falls back to a meaningful `kind`; otherwise
 * `"general"` (which the TUI renders as "General Task").
 */
export function subagentLabel(args: unknown): string {
	const sub = isRecord(args) ? args["subagentType"] : undefined;
	const name = strField(sub, "name");
	if (name) return name;
	const kind = strField(sub, "kind");
	if (kind && kind !== UNSPECIFIED_KIND) return kind;
	return "general";
}

/**
 * Build the child-session transcript body from Cursor's task result `value`.
 * Prefers the model-authored `resultSuffix`; appends a compact render of
 * `conversationSteps` when present. Returns `undefined` when there's nothing
 * useful to post (the prompt message alone still makes the session readable).
 */
function buildTranscript(value: unknown): string | undefined {
	const parts: string[] = [];
	const suffix = strField(value, "resultSuffix");
	if (suffix) parts.push(suffix);
	if (isRecord(value) && Array.isArray(value["conversationSteps"])) {
		const steps = value["conversationSteps"] as unknown[];
		const rendered = steps
			.flatMap((s) => {
				const text = strField(s, "text") ?? strField(s, "content");
				return text ? [text] : [];
			})
			.join("\n\n");
		if (rendered) parts.push(rendered);
	}
	// Cursor's real timing/activity, surfaced where it's guaranteed visible: the
	// child session you navigate into (the collapsed one-liner is rendered by
	// opencode from child-session messages we can't synthesize).
	const activity = activityLine(value);
	if (activity) parts.push(activity);
	const body = parts.join("\n\n").trim();
	return body.length > 0 ? body : undefined;
}

/**
 * Create a REAL opencode child session for a completed Cursor subagent and seed
 * it with the originating prompt + the returned transcript (both as user-role
 * messages via `noReply` — the public API can't synthesize assistant messages).
 * Returns the child session id so the caller can set the task part's
 * `state.metadata.sessionId`, or `undefined` when the bridge is unavailable or
 * any step fails (the card then degrades to its previous, non-navigable form).
 */
export async function linkSubagentSession(opts: {
	parentSessionID: string;
	args: unknown;
	result: unknown;
}): Promise<string | undefined> {
	const bridge = getSubagentBridge();
	if (!bridge) return undefined;
	const { client, directory } = bridge;
	const query = directory ? { directory } : undefined;
	try {
		const description = strField(opts.args, "description") ?? "Subagent task";
		const agent = subagentLabel(opts.args);
		const created = await client.session.create({
			body: {
				parentID: opts.parentSessionID,
				title: `${description} (@${agent} subagent)`,
			},
			...(query ? { query } : {}),
		});
		const childId = created?.data?.id;
		if (!childId) return undefined;

		const prompt = strField(opts.args, "prompt");
		if (prompt) {
			await client.session.prompt({
				path: { id: childId },
				...(query ? { query } : {}),
				body: { noReply: true, parts: [{ type: "text", text: prompt }] },
			});
		}
		const value =
			isRecord(opts.result) && opts.result["status"] === "success"
				? opts.result["value"]
				: undefined;
		const transcript = buildTranscript(value);
		if (transcript) {
			await client.session.prompt({
				path: { id: childId },
				...(query ? { query } : {}),
				body: { noReply: true, parts: [{ type: "text", text: transcript }] },
			});
		}
		return childId;
	} catch {
		// Best-effort: a failed link must never break the turn.
		return undefined;
	}
}
