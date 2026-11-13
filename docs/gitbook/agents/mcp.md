# MCP server: connect Claude or another AI

MCP (Model Context Protocol) is the standard way AI assistants plug into tools. The Juu MCP server lets an AI assistant read the game and play it through an agent's session key, without writing code.

{% hint style="warning" %}
The MCP server only ever uses the **agent's own key**: a fresh wallet that you granted a session to in the Agent Gateway. Never put your main wallet key into it. If you don't give it an agent key, it can only read.
{% endhint %}

## Use the hosted server

The hosted server is at **`https://mcp.playjuu.xyz`** (Streamable HTTP; `https://mcp.playjuu.xyz/mcp` works too). It
reads the main stack; add `?stack=demo` for the demo stack.

* **Read tools** are open: no key needed.
* **Play tools** need your agent's session key, sent by your client on every request as
  `Authorization: Bearer <agent session key>`. The server acts only as that agent, uses the key for that one request,
  keeps it in memory only and never writes or logs it. Without a valid key, play tools refuse; a token that isn't a
  private key is refused outright.
* Before any play, the server checks that the user named in the call has given **this** agent a live session, and the
  Agent Gateway then enforces the session's limits (max per bet, highest floor, daily loss stop, expiry).

Claude Code:

```
claude mcp add --transport http juu https://mcp.playjuu.xyz \
  --header "Authorization: Bearer <the agent wallet's key>"
```

Leave out `--header` for read only. Other clients: any MCP client that speaks Streamable HTTP and can send a header.
For Claude Desktop, use the `mcp-remote` bridge:

```json
{
  "mcpServers": {
    "juu": {
      "command": "npx",
      "args": ["mcp-remote", "https://mcp.playjuu.xyz", "--header", "Authorization: Bearer ${JUU_AGENT_KEY}"],
      "env": { "JUU_AGENT_KEY": "<the agent wallet's key>" }
    }
  }
}
```

{% hint style="warning" %}
Over the hosted server, your agent key travels over HTTPS to Cloudflare and the Juu server on every request. Only ever
use an agent session key with limits you are happy with, and revoke it on the Agents page if in doubt. To keep the agent
key on your own computer, run the server yourself (below).
{% endhint %}

## Tools

**Read:** `juu_floors`, `juu_sides`, `juu_funding`, `juu_climb_premium`, `juu_series`, `juu_bank`, `juu_jackpot`, `juu_positions`, `juu_position`, `juu_price_history`, `juu_recent_collapses`, `juu_leaderboard`, `juu_agent_fee`, `juu_my_session`, `juu_whoami`

**Play (through the Agent Gateway):** `juu_open`, `juu_open_with_tokens`, `juu_climb`, `juu_drop`, `juu_close`, `juu_set_loop`

## Settings

| Variable | Meaning |
| --- | --- |
| `JUU_API_URL` | The data API, default `http://127.0.0.1:8788` |
| `JUU_STACK` | `main` or `demo` (default `demo`) |
| `AGENT_PRIVATE_KEY` | The agent's session key, when you run it yourself over stdio. Optional: leave it out for read-only. The hosted server never takes this setting. |
| `MEZO_RPC_URL` | Default `https://rpc.test.mezo.org` |

## Run it yourself: Claude Code

1. Start the data API: `cd backend && npm install && npm start`
2. In another terminal, add the server:

```
claude mcp add juu \
  -e JUU_API_URL=http://127.0.0.1:8788 \
  -e JUU_STACK=demo \
  -e AGENT_PRIVATE_KEY=<the agent wallet's key> \
  -- node /path/to/juu/backend/mcp/server.js
```

3. Start Claude Code and check it with `/mcp`. Ask, for example: "Use the juu tools to show me the floors and open a 10 MUSD Bull bet on floor 2 for 0xYourAddress."

## Run it yourself: Claude Desktop

Add this to Claude Desktop's config file (Settings, Developer, Edit Config), then restart Claude Desktop:

```json
{
  "mcpServers": {
    "juu": {
      "command": "node",
      "args": ["/path/to/juu/backend/mcp/server.js"],
      "env": {
        "JUU_API_URL": "http://127.0.0.1:8788",
        "JUU_STACK": "demo",
        "AGENT_PRIVATE_KEY": "<the agent wallet's key>"
      }
    }
  }
}
```

## Before the agent can play

The user (you) must first, from your own wallet:

1. grant the agent a session on the Agent Gateway ([how](permissions.md)),
2. approve the Agent Gateway for the MUSD the agent may use,
3. send the agent wallet a little BTC for gas.

## Hosting it

The hosted server is this same program over Streamable HTTP (`MCP_HTTP_PORT` set; it listens on 127.0.0.1 at `/` and
`/mcp`, health check at `/mcp/health`), behind Juu's Cloudflare tunnel. It refuses to start if `AGENT_PRIVATE_KEY` is
set: a hosted server holds no key of its own. See `docs/deploy.md` in the repo.
