# Read-only Vercel demo

Author: Abdelrhman Shalby

This profile serves only the five fictional sample policies. The single Node function caches one Nest bootstrap promise per instance, forces demo and extractive mode, disables Redis and startup seeding, and loads `demo-index.json` read-only. It does not start Python, call ingest, or write a snapshot at runtime. A missing, malformed, empty, unsupported-version or duplicate-ID snapshot produces a stable JSON 503 for all routes until the deployment is replaced. Bootstrap errors are deliberately not retried within that instance.

## Regenerate and verify locally

From the repository root, after installing the existing API dependencies:

```powershell
npm.cmd --prefix apps/api run build
services/ingest/.venv/Scripts/python.exe scripts/build-demo-index.py
services/ingest/.venv/Scripts/python.exe scripts/build-demo-index.py --check
npm.cmd --prefix apps/api test
node deploy/vercel/smoke.js
```

On Linux/macOS use `npm` and `python3`. The generator imports the real `services/ingest/chunking.py`, decodes the sample Markdown exactly as ingest does, and passes the resulting chunks through the compiled API `IndexStore.replace`. It writes the same compact versioned JSON format without timestamps. `--check` compares bytes without modifying the committed snapshot. Python is needed only for local regeneration/verification; the hosted build uses the reviewed snapshot directly. Review and commit a regenerated snapshot through the lead's normal workflow.

The smoke script invokes the actual exported function through a temporary loopback HTTP server, prints the windscreen answer and citation, checks the cold local response against three seconds, and checks all three mutation routes return 403. Its timing includes requiring Nest and bootstrapping, but cannot predict hosted cold starts.

## Vercel project settings (lead action)

| Setting | Value |
| --- | --- |
| Plan | Hobby |
| Root Directory | `deploy/vercel` |
| Include source files outside of the Root Directory in the Build Step | Enabled (required for `apps/api`) |
| Framework Preset | Other (`framework: null`) |
| Node.js Version | 22.x |
| Install Command | `npm --prefix ../../apps/api ci` |
| Build Command | `node build.js` |
| Output Directory | `static` (created empty by the build) |
| Environment variables | None required; do not configure service credentials |

Configuration stays in this directory, so no repository-root `vercel.json` is needed. The root-directory setting and outside-source option keep the existing API package/lockfile authoritative. `build.js` compiles the API and creates an empty static output directory; the function includes the compiled API, its HTML page and the snapshot. Dependency tracing follows the existing API's imports into its installed `node_modules`. No unguarded HTML is published as a static asset. The catch-all rewrite forwards original request paths to `api/index.js`, including `/`, `/health`, `/ask` and the forbidden mutation routes.

After approval, the lead can run the Vercel CLI from the repository root:

```powershell
npx.cmd vercel deploy
```

Select/configure the project with the settings above. Use `npx.cmd vercel deploy --prod` only when the lead intends to publish the production demo. These commands are documentation only; the implementer must not run them or authenticate/link a project. Hosted packaging, routing, anonymous access and cold start remain unverified until the lead builds/deploys and checks the public URL.

## Proxy and limiter

The existing demo guard and `trust proxy = 1` are unchanged. Vercel documents that [`x-forwarded-for`](https://vercel.com/docs/headers/request-headers#x-forwarded-for) contains the client IP and is overwritten rather than preserving external forwarded values. Trusting the immediate Vercel ingress is therefore appropriate for direct Vercel hosting. Additional upstream proxies may collapse visitors onto the proxy IP; their forwarding behavior needs a separate review. Actual hosted header behavior has not been tested here.

The limiter remains 20 questions per minute per IP **per function instance**, resets on cold starts, and is not a global quota. The existing 2000-character question limit and read-only page rendering remain unchanged.

Configuration references: [Vercel function configuration](https://vercel.com/docs/project-configuration/vercel-json#functions), [Node.js function runtime](https://vercel.com/docs/functions/runtimes/node-js), and [monorepo root directory settings](https://vercel.com/docs/monorepos/monorepo-faq).
