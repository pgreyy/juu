# MCP server: connect Claude or another AI

MCP (Model Context Protocol) is the standard way AI assistants plug into tools. The Juu MCP server lets an AI assistant read the game and play it through an agent's session key, without writing code.

{% hint style="warning" %}
The MCP server only ever uses the **agent's own key**: a fresh wallet that you granted a session to in the Agent Gateway. Never put your main wallet key into it. If you don't give it an agent key, it can only read.
{% endhint %}

## Get an agent key

On the app's **Agents** page, choose **Create a new agent key**. The app makes a new wallet for your agent in your
browser and shows its private key **once**, with copy and download buttons. Save it then: Juu never sends it anywhere and
never stores it. Then set the rules and click **Give permission**: that registers the agent's address on the Agent
Gateway, lets the gateway use your MUSD under those rules, and (optionally) sends the agent a little BTC for gas.

Already have a wallet for your agent? Choose **Use my own agent wallet** and paste its address; no key is shown. Never
use your main wallet as an agent: its key would then sit in your MCP client.

## Connect your agent

The hosted server is at **`https://mcp.playjuu.xyz`** (Streamable HTTP; `/mcp` works too). It reads the main stack; add
`?stack=demo` for the demo stack.

* **Read tools** are open: no key needed.
* **Play tools** need your agent's key, sent by your client on every request as
  `Authorization: Bearer <agent key>`. The server acts only as that agent, uses the key for that one request, keeps it
  in memory only and never writes or logs it. Without a valid key, play tools refuse.
* Before any play the server checks that the wallet it plays for has given **this** agent a live session; the Agent
  Gateway then enforces the rules (max per bet, highest floor, daily realised loss stop, expiry).

Right after you create an agent, the Agents page shows these configs with its key already filled in, on that screen only.
Here, replace `<AGENT_PRIVATE_KEY>` with your agent's key.

**Claude Code** (run in a terminal):

```
claude mcp add --transport http juu https://mcp.playjuu.xyz \
  --header "Authorization: Bearer <AGENT_PRIVATE_KEY>"
```

**Cursor** (`~/.cursor/mcp.json`, or `.cursor/mcp.json` in a project):

```json
{
  "mcpServers": {
    "juu": {
      "url": "https://mcp.playjuu.xyz",
      "headers": { "Authorization": "Bearer <AGENT_PRIVATE_KEY>" }
    }
  }
}
```

**Any MCP client** that takes a Streamable HTTP server with headers:

```json
{
  "mcpServers": {
    "juu": {
      "type": "http",
      "url": "https://mcp.playjuu.xyz",
      "headers": { "Authorization": "Bearer <AGENT_PRIVATE_KEY>" }
    }
  }
}
```

You don't need to tell the agent your wallet address: the server looks up which wallet gave this agent permission (the
Agent Gateway's sessions) and plays for that wallet. The play tools' `user` setting is optional; it is only needed when
more than one wallet has given the same agent live permission, and then the server answers with a clear error listing
those wallets. `juu_whoami` shows the wallets an agent plays for.

### Which clients work

| Client | Read tools | Play tools |
| --- | --- | --- |
| Claude Code | Yes | Yes (`--header`) |
| Cursor | Yes | Yes (`headers`) |
| Any client that can send a header | Yes | Yes |
| Claude app, custom connector | Yes ("No sign-in") | Only where the **Request headers** option is available (in beta, not on every account): set `authorization` to `Bearer <AGENT_PRIVATE_KEY>`. Otherwise use Claude Code, Cursor, or the bridge below |
| Claude Desktop, config file | Through the `mcp-remote` bridge | Yes, through the bridge |

The `mcp-remote` bridge for Claude Desktop's config file:

```json
{
  "mcpServers": {
    "juu": {
      "command": "npx",
      "args": ["mcp-remote", "https://mcp.playjuu.xyz", "--header", "Authorization: Bearer ${JUU_AGENT_KEY}"],
      "env": { "JUU_AGENT_KEY": "<AGENT_PRIVATE_KEY>" }
    }
  }
}
```

{% hint style="warning" %}
Your agent key travels over HTTPS to Cloudflare and the Juu server on every request. Only ever use an agent key with
limits you are happy with, and revoke the agent on the Agents page if in doubt. To keep the key on your own computer,
run the server yourself (below).
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
