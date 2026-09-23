# Production Deployment via Komodo

Deploy `quota-dashboard` as a Git-backed Stack managed by Komodo orchestrator.

## Official Documentation References

- Komodo Stacks & Compose: <https://komo.do/docs/deploy/compose>
- Komodo Builds & Git Repos: <https://komo.do/docs/build>
- Komodo Variables & Secrets: <https://komo.do/docs/configuration/variables>
- Komodo Webhooks & Automation: <https://komo.do/docs/automate/webhooks>
- Komodo Architecture & Periphery: <https://komo.do/docs/setup/advanced>

---

## Prerequisites

1. **Upstream 9router**: An upstream `9router` gateway instance reachable over HTTPS (defaults to `https://9router.bangkhan.com`). For local development, loopback HTTP (`http://127.0.0.1:20128`) is also permitted.
2. **Reverse Proxy & TLS**: Komodo does not include an automatic reverse proxy. Public TLS termination for the dashboard must be handled by an external reverse proxy (Nginx Proxy Manager, Caddy, Nginx, or Traefik) on the same host or a dedicated reverse proxy host on the LAN.
3. **DNS**: Public domain or subdomain (e.g. `quota.example.com`) pointing to the host's public IP.
4. **Git Repository**: Project source pushed to a Git repository accessible by the Komodo Periphery agent.

---

## Step-by-Step Deployment

### Step 1: Define Environment Variable

`APP_ORIGIN` must match the exact public origin (protocol + domain, no trailing slash).

In Komodo Core:
1. Navigate to **Settings** → **Variables** (optional global store).
2. Create variable `QUOTA_APP_ORIGIN` with value `https://quota.example.com` (non-secret).
3. Alternatively, define `APP_ORIGIN` directly in the Stack environment.

### Step 2: Create Stack in Komodo

1. In Komodo navigation, select **Stacks** → **Create Stack**.
2. **Server**: Select the target Linux host running `9router`.
3. **Source**: Select **Git**.
4. Configure Git details:
   - **Repository URL**: Git clone URL.
   - **Branch**: Target branch (e.g. `main`).
   - **Compose Path**: `compose.komodo.yaml`.

### Step 3: Configure Stack Environment

Under the Stack **Environment** section, define:

```env
APP_ORIGIN=https://quota.example.com
UPSTREAM_BASE_URL=https://9router.bangkhan.com
BIND_IP=172.16.32.91
```

*(If using global variables: `APP_ORIGIN=[[QUOTA_APP_ORIGIN]]`)*

**Configuration Notes**:
- `APP_ORIGIN` (Required): Exact public HTTPS origin (protocol + host, no trailing slash, e.g. `https://quota.example.com`). Used for strict CSRF, Host header matching, and secure cookie flags.
- `BIND_IP` (Required): The host IP address on the Komodo server to which Docker publishes port `20130` (e.g. `172.16.32.91` for LAN access by an external reverse proxy, or `127.0.0.1` for a local reverse proxy on the same host). The container internally listens on `0.0.0.0:20130`, but Docker maps only to this specific host IP interface. **Never bind to `0.0.0.0` on the host.**
- `UPSTREAM_BASE_URL` (Optional): Upstream `9router` gateway URL (defaults to `https://9router.bangkhan.com` if omitted). This is non-secret public configuration.
- **Security Warning**: The dashboard login proxy transmits the operator password directly to `UPSTREAM_BASE_URL`. Only configure trusted, operator-owned `9router` origins over HTTPS. Plain HTTP is strictly rejected in production (only loopback HTTP like `http://127.0.0.1:20128` is permitted for development).
- Do **not** set `SESSION_SECRET`: Sessions use in-memory crypto tokens.

### Step 4: Deploy and Verify

1. Click **Deploy Stack**.
2. Komodo clones the repository, builds the Docker image, and starts the container with published port `${BIND_IP}:20130:20130` (e.g. `172.16.32.91:20130:20130`).
3. Verify in Komodo UI:
   - Container status shows **Healthy** (verified inside container by `/api/health`).
   - Logs show `Listening on http://0.0.0.0:20130`.

---

## Reverse Proxy Configuration

The container binds to `${BIND_IP}:20130` on the Komodo host. Configure your reverse proxy to forward traffic and preserve Server-Sent Events (SSE).

### Nginx Proxy Manager (NPM) on Dedicated LAN Host

In setups where Nginx Proxy Manager runs on a separate host (e.g. `172.16.32.10`) from the Komodo host (e.g. `172.16.32.91`):

> **Root Cause of 502 Bad Gateway**: If `compose.komodo.yaml` bound to `127.0.0.1`, port 20130 was only reachable locally on the Komodo machine. An external NPM host attempting to connect to `172.16.32.91:20130` was rejected with a connection refused / 502 error. Setting `BIND_IP=172.16.32.91` publishes port 20130 to the LAN interface reachable by NPM.

In the Nginx Proxy Manager web interface:

1. **Details Tab**:
   - **Domain Names**: Enter your public domain (e.g. `quota.example.com` — must match `APP_ORIGIN` protocol and hostname exactly).
   - **Scheme**: `http`
   - **Forward Hostname / IP**: `172.16.32.91` (Komodo host IP)
   - **Forward Port**: `20130`
   - **Cache Assets**: Off
   - **Block Common Exploits**: On
   - **Websockets Support**: Optional / open for future (dashboard uses standard HTTP Server-Sent Events).

2. **SSL Tab**:
   - **SSL Certificate**: Select valid Let's Encrypt certificate.
   - **Force SSL**: On
   - **HTTP/2 Support**: On
   - **HSTS Enabled**: On

3. **Advanced Tab (Custom Nginx Configuration)**:
   Add the following directives to prevent buffering on SSE streams (`/api/live-models`) and avoid client dropouts:
   ```nginx
   proxy_buffering off;
   proxy_cache off;
   proxy_read_timeout 3600s;
   ```

---

### Local Reverse Proxy Examples (Same Host)

If running a reverse proxy on the same host as Komodo with `BIND_IP=127.0.0.1`:

#### Caddy Example (`Caddyfile`)

```caddyfile
quota.example.com {
    encode gzip

    reverse_proxy 127.0.0.1:20130 {
        # Disable buffering to stream SSE live models instantly
        flush_interval -1
    }
}
```

#### Standard Nginx Example

```nginx
server {
    listen 443 ssl http2;
    server_name quota.example.com;

    # SSL certificates managed via Certbot / host ACME
    ssl_certificate /etc/letsencrypt/live/quota.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/quota.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:20130;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE buffering settings for /api/live-models
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

*Note: WebSockets are not required. The dashboard uses HTTP Server-Sent Events (SSE).*

---

## Updates, Webhooks & Rollbacks

- **Manual Redeploy**: Click **Redeploy** on the Stack page to pull the latest Git commit and rebuild.
- **Git Webhook**: In Stack settings under **Automate** / **Webhooks**, copy the webhook URL into GitHub/GitLab repository settings to trigger automatic rebuilds on push (UI labels may vary slightly across Komodo versions).
- **Rollback**: To revert to a prior state, point the Stack Git branch/tag/commit to the previous release and trigger **Redeploy**.

---

## Security & Operational Boundaries

1. **Bridge Network with Explicit IP Port Binding**: Container runs in default Docker bridge mode and publishes `${BIND_IP}:20130:20130`. The container listens on `0.0.0.0:20130` internally, but Docker maps only to the specified `BIND_IP` on the host. Never publish to `0.0.0.0` on the host.
2. **Firewall Ingress Hardening (Strongly Recommended)**:
   When binding to a LAN IP (e.g. `172.16.32.91`), configure firewall rules on the Komodo host to allow TCP port `20130` *only* from the reverse proxy host (`172.16.32.10`), denying all other LAN devices or public access:
   ```bash
   # Example UFW rules on Komodo host (172.16.32.91):
   sudo ufw allow from 172.16.32.10 to any port 20130 proto tcp comment "Allow NPM reverse proxy only"
   sudo ufw deny 20130/tcp comment "Block other ingress to quota dashboard"
   ```
3. **Session State**: Session tokens are held in-memory (up to 100 concurrent sessions, 8-hour TTL). Container restarts invalidate active sessions; operators must re-authenticate with the upstream gateway password.
4. **Single Replica**: Exactly 1 replica. Do not scale replicas due to host port binding and in-memory session pinning.
