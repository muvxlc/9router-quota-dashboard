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
2. **Reverse Proxy & TLS**: Komodo does not include an automatic reverse proxy. Public TLS termination for the dashboard must be handled by an external reverse proxy (Caddy, Nginx, or Traefik) on the host.
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
```

*(If using global variables: `APP_ORIGIN=[[QUOTA_APP_ORIGIN]]`)*

**Configuration Notes**:
- `APP_ORIGIN` (Required): Exact public origin (protocol + host, no trailing slash). Used for strict CSRF, Host header matching, and cookie flags.
- `UPSTREAM_BASE_URL` (Optional): Upstream `9router` gateway URL (defaults to `https://9router.bangkhan.com` if omitted). This is non-secret public configuration.
- **Security Warning**: The dashboard login proxy transmits the operator password directly to `UPSTREAM_BASE_URL`. Only configure trusted, operator-owned `9router` origins over HTTPS. Plain HTTP is strictly rejected in production (only loopback HTTP like `http://127.0.0.1:20128` is permitted for development).
- Do **not** set `SESSION_SECRET`: Sessions use in-memory crypto tokens.

### Step 4: Deploy and Verify

1. Click **Deploy Stack**.
2. Komodo clones the repository, builds the Docker image, and starts the container with published port `127.0.0.1:20130:20130`.
3. Verify in Komodo UI:
   - Container status shows **Healthy** (verified by `/api/health`).
   - Logs show `Listening on http://0.0.0.0:20130`.

---

## Reverse Proxy Configuration

The container binds strictly to loopback `127.0.0.1:20130`. Configure your host reverse proxy to forward traffic and preserve Server-Sent Events (SSE).

### Caddy Example (`Caddyfile`)

```caddyfile
quota.example.com {
    encode gzip

    reverse_proxy 127.0.0.1:20130 {
        # Disable buffering to stream SSE live models instantly
        flush_interval -1
    }
}
```

### Nginx Example

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
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
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

1. **Bridge Network with Loopback Port Mapping**: Container runs in default Docker bridge mode and maps `127.0.0.1:20130:20130`. The container cannot access other host services, and the dashboard is not exposed to public network interfaces directly without passing through the host reverse proxy.
2. **Loopback Exposure**: Only loopback `127.0.0.1` binds on the host. External ingress must traverse the host reverse proxy with TLS and headers intact.
3. **Session State**: Session tokens are held in-memory (up to 100 concurrent sessions, 8-hour TTL). Container restarts invalidate active sessions; operators must re-authenticate with the upstream gateway password.
4. **Single Replica**: Exactly 1 replica. Do not scale replicas due to host loopback port binding and in-memory session pinning.
