"use client";
import { useState } from "react";

const MCP = "https://mcp.playjuu.xyz";
export const DOCS_MCP = "https://playjuu.xyz/docs/mcp";

/** Copies text to the clipboard and says so for two seconds. */
export function CopyButton({ text, label = "COPY" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn-line"
      style={{ minHeight: 36, padding: "0 12px", fontSize: 11 }}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {}
      }}
    >
      {done ? "COPIED" : label}
    </button>
  );
}

function Snippet({ title, note, text }: { title: string; note?: string; text: string }) {
  return (
    <div className="snippet">
      <div className="snippet-head">
        <span className="label" style={{ color: "var(--ink)" }}>{title}</span>
        <CopyButton text={text} />
      </div>
      {note && <p className="note" style={{ margin: "4px 0 8px" }}>{note}</p>}
      <pre><code>{text}</code></pre>
    </div>
  );
}

/**
 * "Connect your agent": the hosted MCP address and ready-to-copy configs. With `agentKey` (only right after creating an
 * agent on this screen) the key is filled in; otherwise a placeholder. The key never leaves this browser tab.
 */
export function ConnectAgent({ stack, agentKey, user }: { stack: string; agentKey?: string | null; user?: string | null }) {
  const url = stack === "demo" ? `${MCP}/?stack=demo` : MCP;
  const key = agentKey || "<AGENT_PRIVATE_KEY>";
  const claudeCode = `claude mcp add --transport http juu ${url} \\\n  --header "Authorization: Bearer ${key}"`;
  const cursor = JSON.stringify({ mcpServers: { juu: { url, headers: { Authorization: `Bearer ${key}` } } } }, null, 2);
  const generic = JSON.stringify({ mcpServers: { juu: { type: "http", url, headers: { Authorization: `Bearer ${key}` } } } }, null, 2);
  return (
    <section className="connect" aria-labelledby="connect-h">
      <h2 id="connect-h" className="h2">CONNECT YOUR AGENT</h2>
      <p className="note" style={{ marginTop: 6 }}>
        Point any MCP client at <span className="mono" style={{ color: "var(--ink)" }}>{url}</span>. Reading needs no key. To play, the client sends its
        agent&apos;s own key on every request; the server uses it for that request only and never stores it. Full guide:{" "}
        <a href={DOCS_MCP}>playjuu.xyz/docs/mcp</a>.
      </p>
      {user && (
        <p className="note">Tell your agent which wallet it plays for: <span className="mono" style={{ color: "var(--ink)" }}>{user}</span> (the play tools take it as <span className="mono">user</span>).</p>
      )}
      {agentKey ? (
        <p className="txnote error" role="alert">These configs contain your agent&apos;s private key. Keep them private: anyone with the key can play within this agent&apos;s rules until you revoke it. They are shown on this screen only.</p>
      ) : (
        <p className="note">Replace <span className="mono">&lt;AGENT_PRIVATE_KEY&gt;</span> with your agent&apos;s key. Never use your main wallet&apos;s key.</p>
      )}
      <div className="snippets">
        <Snippet title="CLAUDE CODE" note="Run in a terminal." text={claudeCode} />
        <Snippet title="CURSOR" note="Add to ~/.cursor/mcp.json (or .cursor/mcp.json in a project)." text={cursor} />
        <Snippet title="ANY MCP CLIENT (JSON)" note="For clients that take a Streamable HTTP server with headers." text={generic} />
      </div>
      <p className="note">
        Claude app (custom connectors): add <span className="mono">{url}</span> with &quot;No sign-in&quot; for the read tools. Playing needs the
        &quot;Request headers&quot; option (in beta, not on every account) set to <span className="mono">authorization</span> ={" "}
        <span className="mono">Bearer {"<key>"}</span>; without it, use Claude Code or Cursor.
      </p>
    </section>
  );
}
