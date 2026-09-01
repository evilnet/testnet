# Afternet Testnet

A Docker-based test environment for running [Nefarious IRCd](https://github.com/evilnet/nefarious2) and [X3 Services](https://github.com/evilnet/x3) together.

It doubles as the reference target for testing the [Seance](https://github.com/evilnet/seance) web client
against the IRCv3 work on Nefarious's `ircv3.2-upgrade` branch — WebSockets, `draft/persistence`
(the built-in bouncer), chat history and SASL answered locally by the ircd against Keycloak.
See [Testing Seance](#testing-seance) below.

## Prerequisites

- Git
- Docker and Docker Compose (v2.24+ — the compose file uses `env_file: required:`)
- SSH key configured for GitHub (for the submodules)

## Getting Started

### 1. Clone the Repository

```bash
git clone --recurse-submodules git@github.com:evilnet/testnet.git
cd testnet
```

If you already cloned without `--recurse-submodules`, initialize the submodules:

```bash
git submodule update --init --recursive
```

### 2. Configuration

Configuration files are stored in `data/` and mounted directly into containers:

- `data/ircd.conf` - Nefarious IRCd configuration (included by `ircd-docker.conf` *after*
  the generated `base.conf`, so anything here overrides the template)
- `data/x3.conf` - X3 services configuration (mounted to container)
- `.env` - Environment variables; these fill the `%PLACEHOLDER%`s in
  `nefarious/tools/docker/base.conf-dist` at container start
- `.env.local` - Local overrides, optional, not committed to the repo

### 3. Build and Run

```bash
# Build the containers
docker compose build

# Start the services
docker compose up -d

# View logs
docker compose logs -f
```

### 4. Connect

Once running, you can connect to the IRC server on `localhost`:

- **Plain IRC:** port `16667`
- **TLS IRC:** port `16697`
- **WebSocket (plain):** `ws://127.0.0.1:18067/`
- **WebSocket (TLS):** `wss://127.0.0.1:18443/`

All host ports bind to `127.0.0.1` only. The IRC/WebSocket listeners are shifted by
10000 from their in-container numbers so this stack can run alongside a Seance dev
ircd that already owns 6667/6697/8067/8443.

## Project Structure

```
testnet/
├── docker-compose.yml    # Docker orchestration
├── .env                  # Environment variables (feed base.conf-dist)
├── nefarious/            # Nefarious IRCd (git submodule)
├── x3/                   # X3 Services (git submodule)
├── data/                 # Configuration files (committed)
│   ├── ircd.conf         # Nefarious IRCd config
│   ├── saslusers         # SASL user list
│   └── x3.conf           # X3 services config
└── tests/                # Integration tests
```

## Submodules

This repository uses git submodules for the main components:

| Submodule | Repository | Branch |
|-----------|------------|--------|
| nefarious | https://github.com/evilnet/nefarious2 | `ircv3.2-upgrade` |
| x3 | git@github.com:evilnet/x3.git | `master` |

Nefarious tracks `ircv3.2-upgrade` rather than `master`: the WebSocket listener,
`draft/persistence` bouncer and `SASL_LOCAL` features that `data/ircd.conf` turns on
only exist on that branch.

### Updating Submodules

To pull the latest changes from upstream:

```bash
git submodule update --remote --merge
```

## Exposed Ports

Everything binds to `127.0.0.1`.

| Host port | In container | Service |
|-----------|--------------|---------|
| 16667 | 6667 | IRC (plain) |
| 16697 | 6697 | IRC (TLS) |
| 18067 | 8067 | IRC over WebSocket (plain, `ws://`) |
| 18443 | 8443 | IRC over WebSocket (TLS, `wss://`) |
| 9998 | 9998 | IRC (TLS) |
| 4497 | 4497 | Server link (TLS) |
| 18080 | 8080 | Keycloak |

X3 links to the ircd on port 4496 inside the compose network; that one is not published.

## Testing Seance

`data/ircd.conf` enables the pieces the [Seance](https://github.com/evilnet/seance)
client negotiates, on top of the stock docker config:

- A **plain-text WebSocket listener** on 8067 (host `18067`), so a browser and the test
  suites can use `ws://127.0.0.1:18067/` with no certificate trust dance.
- The **built-in bouncer** / `draft/persistence`: `BOUNCER_ENABLE`, auto-resume,
  auto-replay, a 10-minute session hold, and `BOUNCER_REQUIRE_TLS=FALSE` because the
  test client connects over plain `ws://`.
- The **draft caps** Seance asks for: `draft/chathistory`, `draft/event-playback`,
  `draft/message-redaction`, `draft/read-marker`, `draft/persistence`, `draft/bouncer`.
- **`SASL_LOCAL`** (`PLAIN,OAUTHBEARER`), so the ircd answers SASL itself against
  Keycloak instead of relaying to X3.
- `CTCP_VERSIONING=FALSE` — on this branch `s_user.c` writes the CTCP VERSION notice
  straight to the socket instead of through the sendQ, which lands as a bare IRC line
  mid-handshake and makes browsers drop the WebSocket with "invalid opcode".
- Raised clone limits, because the live tests reconnect a lot.

### Keycloak realm setup

The `keycloak` service starts empty (its state lives in the `keycloak_data` volume), so
create the realm once after first `docker compose up -d`. Admin console:
<http://127.0.0.1:18080/> — bootstrap login `admin` / `admin`.

1. Create a realm named **`testnet`**.
2. Create a confidential client **`irc-ircd`**: client authentication **on**, and
   **Direct access grants** enabled (the ircd uses an ROPC grant for SASL PLAIN).
3. Set its client secret to match `client_secret` in `data/ircd.conf`
   (`seance-ircd-secret` as committed — a throwaway value for this loopback-only
   testnet; change both sides together if you like).
4. Add a test user with a non-temporary password. Seance's probe scripts default to
   `seancepass1`.

`data/ircd.conf` points at `http://keycloak:8080` — the service name on the compose
network — so the host port shift does not matter to the ircd.

## Integration Tests

```bash
./runtests.sh          # docker compose --profile test run --rm integration-tests
```

The tests run inside the compose network and talk to `nefarious:6667` directly, so the
host port mapping does not affect them.

`sigterm-persistence.test.ts` stops and starts the `x3` container to prove X3 flushes
its database on SIGTERM, which is why the `integration-tests` service mounts
`/var/run/docker.sock`. Drop that mount (and the test) if you would rather not hand the
test container the Docker socket.

## Troubleshooting

### Submodule issues

If submodules appear empty after cloning:

```bash
git submodule update --init --recursive
```

### Container won't start

Check the logs for errors:

```bash
docker compose logs nefarious
```

### Build can't find libkc or libmdbx

The `ircv3.2-upgrade` branch links against them; `docker-compose.yml` pulls both as
additional build contexts straight from git, so the build needs network access.

### Permission issues

The containers run as UID/GID 1234. Ensure mounted volumes have appropriate permissions.

## Development

To make changes to the submodules:

```bash
cd nefarious  # or x3
git checkout -b my-feature
# make changes
git commit -am "My changes"
git push origin my-feature
```

Then update the parent repo to track the new commit:

```bash
cd ..
git add nefarious  # or x3
git commit -m "Update nefarious submodule"
```
