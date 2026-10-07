# Development and deployment

## Local setup

Use Node.js 22 or newer locally; the deployed Azure Functions app uses Node.js 22.

```sh
npm ci
npm ci --prefix api
npm run dev
```

The frontend listens on port 5173 and proxies `/api` to the local API on 127.0.0.1:7071. The same API engine handles local and Azure requests. Local sessions persist in ignored `.local/sessions/` files. No Azure account, storage secret, or Docker container is needed for local demo mode.

```sh
npm test
npm run build
```

`npm run build` typechecks the frontend, generates Vite assets and an offline asset cache, and compiles the Functions API. `npm run preview` serves only the built frontend; use a running local API/proxy or deploy to exercise live sessions.

## Azure deployment

The approved deployment uses one **Windows Azure Functions Consumption** app in **West US** serving both frontend and API, plus a **StorageV2 / Standard LRS** account with a table named `Riverton`. The originally preferred Static Web Apps regions do not overlap this student subscription's allowed regions. There is no Cosmos DB, SignalR, custom domain, or fixed App Service plan.

Sign in using `az login`. This Mac has an isolated CLI installed at `.local/azure-cli`; its entry point is `.local/azure-cli/bin/python -m azure.cli login` (quote absolute paths containing spaces). The deployment script detects that installation automatically. Otherwise it uses `az` on PATH; override the executable with `RIVERTON_AZ` if needed.

```sh
npm run deploy
```

The script checks authentication, tests and builds, registers the required resource providers, provisions resources, creates the table, configures backend settings, packages the frontend and compiled API together, and publishes via ZIP deployment. Credentials are never written to source files. A protected temporary settings file is deleted after configuration. The ignored `.azure-deploy.json` stores resource names and the final URL for repeat deployments. It prevents silently provisioning in a different subscription.

The package has an empty Functions HTTP route prefix. Its catch-all handler serves whitelisted SPA routes and public assets; `/api/sessions/...` uses the same API engine as local development. `RIVERTON_SERVE_FRONTEND=true` enables this adapter. `RIVERTON_STORAGE_CONNECTION` is stored as a Function App setting. Azure host storage is configured by resource creation. Application Insights is not provisioned.

Default region is `westus`. `RIVERTON_AZURE_REGION` can select another supported Consumption region on an initial deployment. Existing resources retain their saved placement. The optional original hosting adapter can be deployed with `node scripts/deploy.mjs --static-web-apps` in a subscription whose policy permits a Static Web Apps region; this is a separate deployment, not a migration of the saved manifest.

The **Deploy Riverton to Azure** workflow uses manual dispatch and the combined Functions package. Configure GitHub authentication after deployment:

```sh
npm run deploy:github
```

This creates a user-assigned identity in the dedicated resource group, grants **Website Contributor** only on this Function App, and trusts GitHub OIDC tokens from the connected repository's current branch. It sets the identity identifiers as repository secrets and the app name as a repository variable. It does not enable SCM basic authentication or store a publishing password. See [Microsoft's Functions GitHub Actions documentation](https://learn.microsoft.com/en-us/azure/azure-functions/functions-how-to-github-actions).

Commit and push the workflow before it is available on GitHub, then dispatch **Deploy Riverton to Azure** from the trusted branch. Local changes alone do not activate it. Code pushes run checks but do not publish automatically. If the deployment branch changes, rerun the configuration command on that branch. Direct deployment remains available through `npm run deploy`.

Consumption hosting has no fixed hosting fee. Storage transactions, retained data, function execution, and subscription allowances affect cost. Cold starts are possible: open and rehearse the live session shortly before class. Cleanup is optional and destructive: delete only the dedicated resource group after deciding whether to retain the app and sessions.

## Session and storage model

Partition key is the readable class code; a cryptographically random session ID is retained in metadata. One `session` row contains presenter-token hash, creation/end times, screen, round, voting state, epoch, demo flag, and revision. `p:<participantId>` rows contain anonymous token hashes and presence times. `r:<epoch>:<participantId>:<round>` rows contain validated choices and submission times. Round 6 is the unscored ethics poll.

Mutations are queued per session within each Functions worker to avoid a burst competing with itself. Every write includes an ETag-conditional update to the session metadata in the same Table transaction as changed participant/response rows. Concurrent submissions retry from a consistent snapshot. A response row is created once, not overwritten; duplicate submissions and submissions after closure fail. Reset increments an epoch and hides prior response rows. Poll requests include the current epoch, preventing delayed submissions from a previous run. Old rows remain until the dedicated storage is cleaned up. Sessions expire after 24 hours; there is no automatic Table Storage TTL or scheduled deletion service.

The application supports up to 120 participants per session, including sample participants. Sample inserts are batched by round to stay within Azure's 100-operation transaction limit. Presenter tokens and participant tokens use secure random bytes and are stored only as hashes on the backend. Their browser copies use localStorage so reload/recovery works. Recovery query tokens are removed from browser history on use; referrer policy prevents forwarding the link to other sites.

Public endpoints expose only counts and screen state before reveals. The presenter summary requires a host bearer token; student state with a participant bearer token adds that participant's choices and personal result. Display never includes raw responses, token hashes, presenter token, or sample labels. Scoring stays in `api/src/scoring.ts` and uses five equally weighted decision vectors, then compares the full pattern with interpretive prototypes. It is not a validated ethics instrument. Complete strategies only contribute to class profiles; the final poll does not affect scoring.

## API

All POST requests use a JSON object. Authenticated calls use `Authorization: Bearer <token>`. Bodies are limited to 4 KiB.

| Endpoint | Authorization | Body / purpose |
|---|---|---|
| POST `/api/sessions` | Anonymous | `{ "demo": false }`; returns code and private host token |
| POST `/api/sessions/:code/join` | Anonymous initially; participant for rejoin | `{}`; returns anonymous participant token |
| GET `/api/sessions/:code/state` | Optional participant | Public screen/counts; participant sees own choices/result |
| POST `/api/sessions/:code/responses` | Participant | `{ "round": 1, "epoch": 0, "value": "shared" }` |
| GET `/api/sessions/:code/summary` | Presenter | Counts, presence, aggregate results, sample status |
| POST `/api/sessions/:code/control` | Presenter | `{ "action": "open" }`; reset/end/seed require `confirmed: true` |
| GET `/api/sessions/:code/display` | Anonymous | Public projector state and only revealed aggregates |
| POST `/api/sessions/:code/final-poll` | Participant | `{ "epoch": 0, "value": "no" }` |

Polling pauses in hidden pages, resumes on visibility/online events, times out after eight seconds, and backs off up to 30 seconds. Last successful views remain visible during recoverable errors. Reloading never manufactures a second seat if the session token remains available.

## Verification status

Automated tests cover scoring patterns, input boundaries, 30 concurrent joins/submissions, duplicate races, authentication, pre-reveal privacy, funding/commitment aggregation, final-poll independence, reset, persistence, demo, and sample-preservation behavior. The Azure Table integration test runs only when `RIVERTON_TEST_STORAGE` is supplied; use a disposable emulator or test storage account. It creates and deletes its own temporary table.

```sh
RIVERTON_TEST_STORAGE='UseDevelopmentStorage=true' npm test
```

Deployed and verified on October 6, 2026:

- [Public application](https://rebuild-riverton-e6396948.azurewebsites.net)
- [Presenter access](https://rebuild-riverton-e6396948.azurewebsites.net/control)
- [Demo rehearsal](https://rebuild-riverton-e6396948.azurewebsites.net/demo)
- [Offline backup](https://rebuild-riverton-e6396948.azurewebsites.net/offline)

All six automated tests passed against both the local Azure Storage emulator and real Azure Table Storage. The concurrency test uses three independent engine/store instances. The deployed browser rehearsal completed 30 participants across all five decision types, duplicate rejection, pre-reveal privacy, close/reveal, projector updates, personal results, the class profile, both case studies, final poll, and ending. A separate rehearsal verified the 30-sample demo, unauthorized presenter rejection, phone reconnect/reload without a second seat, confirmed reset, and offline controls/projector after a disconnected reload. Mobile widths 375, 390, and 430 had no horizontal overflow; projector screenshots were checked at 1920 by 1080. The full live rehearsal reported no browser errors.

Browser rehearsal artifacts are kept in ignored `output/playwright/`. GitHub OIDC identifiers and branch trust are configured for `codex/rebuild-riverton`. The initial Azure deployment was made directly through the CLI. Repository checks run on pushes; Azure publishing requires dispatching the deployment workflow from the trusted branch. Presentation-room Wi-Fi and the physical projector still need an on-site rehearsal.

Case-study sources and the classroom operator guide are in `shared/content.ts` and `docs/operator-guide.md`. The fictional Riverton budgets, investment figures, and jobs are not presented as actual statistics for Method or Menomonee Valley.


## Project files

- `src/App.tsx`: home, presenter entry, and routes.
- `src/Student.tsx`: five phone interactions, persistent seat, personal result, and final poll.
- `src/Control.tsx`: presenter actions, recovery link, sample loading, and confirmation controls.
- `src/Projector.tsx`: 16:9 lobby, round reveals, profile, cases, poll, and closing.
- `src/api.ts`, `src/backup.ts`: polling/reconnect behavior and offline presentation state.
- `src/components.tsx`, `src/styles.css`, `src/main.tsx`, `src/vite-env.d.ts`: shared visuals, responsive styling, and application bootstrap.
- `shared/model.ts`, `shared/content.ts`: request/state types and classroom content with primary case sources.
- `api/src/engine.ts`, `api/src/store.ts`, `api/src/scoring.ts`: session rules, transactional storage, and server-only strategy interpretation.
- `api/src/http.ts`, `api/src/azure.ts`, `api/src/local.ts`, `api/src/static.ts`: API boundary validation and Azure/local serving adapters.
- `api/test/engine.test.ts`, `api/test/azure-store.test.ts`, `api/test/static.test.ts`: behavior, concurrent storage, and asset-routing checks.
- `scripts/dev.mjs`, `scripts/build-cache.mjs`, `scripts/package-functions.mjs`, `scripts/deploy.mjs`, `scripts/configure-github.mjs`: development, offline caching, packaging, provisioning, and GitHub OIDC setup.
- `.github/workflows/checks.yml`, `.github/workflows/deploy.yml`: verification and manual deployment.
- `docs/operator-guide.md`: classroom operation and rehearsal.
- `package.json`, `package-lock.json`, `api/package.json`, `api/package-lock.json`, `tsconfig.json`, `api/tsconfig.json`, `api/host.json`, `api/.funcignore`, `vite.config.ts`, `.gitignore`, `index.html`, `public/favicon.svg`, `public/staticwebapp.config.json`: dependencies, build/runtime configuration, entry page, and hosting assets.
