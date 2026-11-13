# Deploying Juu

The backend (keeper bot, Data API, MCP server) runs on an Ubuntu 24.04 VPS that also hosts another project. Juu is kept
apart from it: its own Linux user `juu` with no sudo, everything under `/home/juu`, its own Node (nvm), its own pm2, its
own Cloudflare tunnel, and Node ports on 127.0.0.1 only. No port is opened for Juu: the tunnel only makes outgoing
connections. The app and the landing page run on Vercel.

| Piece | Where | Address |
| --- | --- | --- |
| Keeper bot + Data API (`juu-backend`) | VPS, pm2 as `juu` | 127.0.0.1:8788, public at `https://api.playjuu.xyz` |
| MCP server over HTTP (`juu-mcp`) | VPS, pm2 as `juu` | 127.0.0.1:8789 (not public) |
| Cloudflare tunnel "juu" (`juu-tunnel`) | VPS, pm2 as `juu` | outgoing only; metrics on 127.0.0.1:20250 |
| Landing (`frontend/landing`) | Vercel project `juu-landing` | `https://playjuu.xyz` |
| App (`frontend/app`) | Vercel project `juu-app` | `https://app.playjuu.xyz` |

The domain `playjuu.xyz` is on Cloudflare. `api.playjuu.xyz` is a public hostname of the tunnel; `playjuu.xyz` and
`app.playjuu.xyz` point at Vercel.

Each step below is marked:

* **ADMIN**: needs the server's admin login and `sudo`.
* **JUU**: runs as the `juu` user (`ssh juu-vps`), no sudo.
* **LAPTOP**: on your own computer, in the project folder.
* **CLOUDFLARE** / **VERCEL**: in that dashboard or CLI.

## Rules on this server

* Never touch the other project's users, files, services, or its `cloudflared` system service and routes. Juu runs its
  own `cloudflared` binary from `/home/juu/.local/bin` under juu's pm2, with its own tunnel.
* ufw allows only 22/tcp in. Ports 80 and 443 stay closed; Juu doesn't need them.
* SSH is key only (`passwordauthentication no`, `pubkeyauthentication yes`, `permitrootlogin no`).

## Order

1. A1 user and SSH login (ADMIN)
2. J1 Node and pm2, J2 GitHub access and clone, J3 `.env`, J4 cloudflared (JUU)
3. L1 stop the laptop keeper and copy its state (LAPTOP)
4. J5 first start (JUU)
5. C1 tunnel route for `api.playjuu.xyz` (CLOUDFLARE), then check from outside
6. A2 start on boot (ADMIN)
7. V1 to V5 Vercel, C2 DNS records for Vercel (CLOUDFLARE)

Only one keeper may run at a time: two keepers would send the same transactions. L1 stops the one on the laptop before
J5 starts the one on the server.

## A1. The juu user (ADMIN)

```bash
sudo adduser --disabled-password --gecos "" juu
sudo chmod 750 /home/juu
groups juu                                  # juu : juu users   (no sudo group)
sudo install -d -m 700 -o juu -g juu /home/juu/.ssh
sudo nano /home/juu/.ssh/authorized_keys    # paste your public key
sudo chown juu:juu /home/juu/.ssh/authorized_keys && sudo chmod 600 /home/juu/.ssh/authorized_keys
```

`--disabled-password` means juu has no password: it can't use sudo and is reached only with an SSH key.

On the LAPTOP, `~/.ssh/config`:

```
Host juu-vps
    HostName <the VPS's IP address>
    User juu
    IdentitiesOnly yes
    # plus the same key or agent line you use for your admin login
```

Test: `ssh juu-vps whoami` prints `juu`.

## J1. Node (nvm) and pm2 (JUU)

```bash
ssh juu-vps
curl -fsSo ~/nvm-install.sh https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh
bash ~/nvm-install.sh && rm ~/nvm-install.sh
. ~/.nvm/nvm.sh
nvm install 22
nvm alias default 22
npm install -g pm2
pm2 install pm2-logrotate
```

## J2. GitHub access and clone (JUU, then LAPTOP)

The repo is private, so the server gets its own read-only deploy key. It can pull, never push.

```bash
ssh-keygen -t ed25519 -f ~/.ssh/juu_deploy -N "" -C "juu server deploy key (read only)"
cat >> ~/.ssh/config <<'EOF'
Host github.com
    IdentityFile ~/.ssh/juu_deploy
    IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config
ssh-keyscan github.com >> ~/.ssh/known_hosts
```

On the LAPTOP, add the public key to the repo as a read-only deploy key:

```bash
ssh juu-vps 'cat ~/.ssh/juu_deploy.pub' > juu_deploy.pub
gh repo deploy-key add juu_deploy.pub --repo <owner>/juu --title "juu server (read only)"
rm juu_deploy.pub
```

Then as JUU:

```bash
git clone git@github.com:<owner>/juu.git ~/juu
```

## J3. The .env file (JUU)

```bash
cd ~/juu
cp .env.example .env
chmod 600 .env
nano .env
```

Fill in the **server** section only:

* `KEEPER_KEY`: the keeper wallet's key (the same as in the laptop's `.env`). Paste it in nano, never in a command line.
* `TUNNEL_TOKEN`: the token of the Cloudflare tunnel "juu".
* `CORS_ORIGINS=https://playjuu.xyz,https://app.playjuu.xyz`.
* Leave `AGENT_PRIVATE_KEY` and `MCP_AUTH_TOKEN` empty: the MCP server is read only.

Leave every laptop-only key empty. The deployer key never goes on the server.

```bash
ls -l .env       # -rw------- 1 juu juu ... .env
```

## J4. cloudflared in juu's home (JUU)

Juu uses its own copy of `cloudflared`, not the system one, so an update on either side can't affect the other.

```bash
mkdir -p ~/.local/bin
V=<latest release, from github.com/cloudflare/cloudflared/releases>
curl -fsSLo ~/.local/bin/cloudflared "https://github.com/cloudflare/cloudflared/releases/download/$V/cloudflared-linux-amd64"
chmod +x ~/.local/bin/cloudflared
~/.local/bin/cloudflared --version
sha256sum ~/.local/bin/cloudflared      # compare with the checksum in that release's notes
```

`deploy/tunnel.sh` starts it with the token from `.env`, so the token never appears in a command line or in pm2's
saved process list.

## L1. Stop the laptop keeper and copy its state (LAPTOP)

Stop the backend on the laptop first. Then copy the keeper's state, which includes the jackpot secrets it needs to
reveal the draws it has already committed:

```bash
ssh juu-vps 'mkdir -p ~/juu/backend/data && chmod 700 ~/juu/backend/data'
scp backend/data/*.json juu-vps:juu/backend/data/
ssh juu-vps 'chmod 600 ~/juu/backend/data/*.json'
```

## J5. First start (JUU)

```bash
~/juu/deploy/deploy.sh
```

It pulls, installs the backend, starts `juu-backend`, `juu-mcp` and `juu-tunnel` under pm2, saves the process list
and prints the health checks. Logs: `pm2 logs juu-backend`, `pm2 logs juu-tunnel`.

```bash
ss -tln | grep -E ':(8788|8789|20250) '     # all on 127.0.0.1
curl -s 127.0.0.1:20250/ready               # "readyConnections" above 0 = tunnel connected
```

## C1. Route api.playjuu.xyz to the backend (CLOUDFLARE)

Zero Trust, Networks, Tunnels, "juu", Public hostnames, Add: subdomain `api`, domain `playjuu.xyz`, service
`HTTP` `localhost:8788`. Cloudflare creates the DNS record itself.

Check from the LAPTOP:

```bash
curl -s https://api.playjuu.xyz/health
curl -s https://api.playjuu.xyz/api/main/bank
curl -sI -H "Origin: https://app.playjuu.xyz" https://api.playjuu.xyz/api/series | grep -i access-control
```

## A2. Start Juu on boot (ADMIN)

As JUU, `pm2 startup systemd -u juu --hp /home/juu` prints one `sudo env PATH=... pm2 startup ...` line. Run that line
with the admin login. It creates the `pm2-juu` systemd service, which starts juu's pm2 (as juu) at boot. Then as JUU:
`pm2 save`. pm2 also restarts any of the three processes if it crashes.

After a Node upgrade with nvm the path in that line changes: run `pm2 unstartup` and `pm2 startup` again and give the
admin the new line.

## Updating the backend (JUU)

From the laptop, after pushing to GitHub:

```bash
ssh juu-vps '~/juu/deploy/deploy.sh'
```

It restarts only Juu's processes. It prints the previous commit and the rollback command, which is:

```bash
ssh juu-vps 'git -C ~/juu checkout <previous commit> && ~/juu/deploy/deploy-current.sh'
```

## The MCP server

`juu-mcp` runs read only on 127.0.0.1:8789 and is not public. To publish it, add a second public hostname to the tunnel
(for example `mcp.playjuu.xyz` to `localhost:8789`). If an agent key is ever added to the server, clients must send
`Authorization: Bearer <MCP_AUTH_TOKEN>`, and the server refuses to start without a token of at least 24 characters.

## Vercel

Two projects on the Hobby plan, both linked to the GitHub repo so every push to `main` redeploys them.

| Project | Root directory | Framework | Domain |
| --- | --- | --- | --- |
| juu-landing | `frontend/landing` | Next.js | `playjuu.xyz` |
| juu-app | `frontend/app` | Next.js | `app.playjuu.xyz` |

The root directories are inside the `frontend` npm workspace; Vercel installs from `frontend/package-lock.json`.

### Environment variables

App (`juu-app`):

| Name | Value |
| --- | --- |
| `JUU_API_URL` | `https://api.playjuu.xyz` |
| `NEXT_PUBLIC_DATA_API_URL` | `https://api.playjuu.xyz` |
| `NEXT_PUBLIC_CHAIN_ID` | `31611` |
| `NEXT_PUBLIC_MEZO_RPC` | `https://rpc.test.mezo.org` |
| `NEXT_TELEMETRY_DISABLED` | `1` |

Landing (`juu-landing`):

| Name | Value |
| --- | --- |
| `JUU_API_URL` | `https://api.playjuu.xyz` |
| `NEXT_PUBLIC_APP_URL` | `https://app.playjuu.xyz` |
| `NEXT_PUBLIC_DATA_API_URL` | `https://api.playjuu.xyz` |
| `NEXT_TELEMETRY_DISABLED` | `1` |

The footer links (`NEXT_PUBLIC_DOCS_URL`, `NEXT_PUBLIC_SOURCE_URL`, `NEXT_PUBLIC_X_URL`, `NEXT_PUBLIC_MEZO_DISCORD_URL`)
are left unset for now, so they show as plain text.

The contract addresses are not environment variables: they are built into the app from
`frontend/app/src/lib/addresses.ts`, a copy of `backend/config/addresses.json` (the same addresses as in
docs/build-log.md). After a redeploy of the contracts, update both files and push.

No private key and nothing from the server's `.env` goes into Vercel. Every `NEXT_PUBLIC_` value is visible to anyone
who opens the site, and none of the values above is secret.

The sites read the Data API through their own `/api/...` path: Vercel forwards those requests to `JUU_API_URL`, so the
browser never needs CORS for them. `CORS_ORIGINS` on the server additionally lets pages on `playjuu.xyz` and
`app.playjuu.xyz` call the API directly; no other site can.

### V1 to V5 (VERCEL)

1. **V1** Create both projects and set each root directory and framework as in the table.
2. **V2** Connect both to the GitHub repo, production branch `main`.
3. **V3** Add the environment variables above for Production and Preview.
4. **V4** Add the domains: `playjuu.xyz` to `juu-landing`, `app.playjuu.xyz` to `juu-app`.
5. **V5** Deploy both, open both sites and check the ticker shows live figures.

### C2. DNS records for Vercel (CLOUDFLARE)

In Cloudflare, DNS, Records, with the proxy **off** (grey cloud, "DNS only") so Vercel can issue the certificates:

| Type | Name | Content |
| --- | --- | --- |
| A | `@` (playjuu.xyz) | the A value Vercel shows for `playjuu.xyz` |
| CNAME | `app` | the CNAME value Vercel shows for `app.playjuu.xyz` |

Leave the `api` record that the tunnel created as it is (proxied).
