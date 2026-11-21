# CodeArena

**Compete. Code. Conquer.** A classroom competition application with React/Vite, Express, Socket.IO, MongoDB/Mongoose, and Python judging through hosted OnlineCompiler.io. Mentors own their question banks and contests; students join a waiting room using a private room code without creating an account.

The fixed format is 20 MCQs at 45 seconds and 2 marks each, followed by two separate 15-minute coding rounds worth 30 marks each: **45 minutes and 100 marks**. Students share one timeline anchored to the contest start time.

## Requirements and setup

- Node.js 22.13 or newer (an active LTS release is recommended) and npm.
- A running local MongoDB server or MongoDB Atlas database.
- A modern browser. Student devices need only a browser and network access.
- Optional OnlineCompiler.io endpoint with Python 3 support for automatic grading. Manual review is available without it.

Run commands from the repository root. Windows examples use `npm.cmd` because PowerShell execution policy may block `npm.ps1`; no policy change is required. On other platforms use `npm` instead.

```powershell
npm.cmd install
if (-not (Test-Path -LiteralPath .env)) { Copy-Item .env.example .env }
```

The current workspace already has a private root `.env` with a random JWT secret and local MongoDB URI; preserve it. For a fresh installation, generate a secret with the command below and put it into `JWT_SECRET` in your private `.env`; it must be at least 32 characters. Set `MONGO_URI` and review `CLIENT_ORIGIN`. Keep this file out of source control. Never prefix secrets with `VITE_` or put them in browser code.

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

MongoDB is already installed as a Windows service on the current machine. For a new machine, install MongoDB Community as a service or use Atlas. Check the local service with `Get-Service -Name MongoDB`; if stopped, start it from Windows Services or run `Start-Service -Name MongoDB` in an elevated PowerShell. Use `mongodb://127.0.0.1:27017/codearena` for the standard local service. MongoDB persists its data in the service's configured data directory. Do not run a second MongoDB process on the same port.

Start the Vite frontend and backend together:

```powershell
npm.cmd run dev
```

Open the frontend URL printed by Vite (normally `http://localhost:5173`). The backend normally uses port 5000. Development requests use the Vite proxy so the browser can use relative API and Socket.IO URLs.

## Environment reference

See [.env.example](./.env.example). Environment changes require restarting the server.

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | `development` locally; `production` behind HTTPS on a public deployment. |
| `PORT` | Express port, default 5000; hosting providers may supply their own. |
| `TRUST_PROXY` | `1` trusts one reverse-proxy hop (Render); leave `0` for direct local/LAN access. Configure only for the actual proxy topology. |
| `MONGO_URI` | Private local MongoDB or Atlas connection string. |
| `JWT_SECRET` | Required random signing secret of at least 32 characters. Changing it invalidates existing sessions. |
| `CLIENT_ORIGIN` | Comma-delimited allowlist of exact browser origins, including scheme and port. No URL paths, trailing slashes, or wildcard. |
| `ONLINECOMPILER_API_URL` | OnlineCompiler API base URL; defaults to `https://api.onlinecompiler.io/api`. |
| `ONLINECOMPILER_API_KEY` | Server-only OnlineCompiler API key. Leave blank to use manual grading. |
| `ONLINECOMPILER_COMPILER` | Compiler identifier; defaults to `python-3.14`. |
| `ONLINECOMPILER_CONCURRENCY` / `ONLINECOMPILER_RETRIES` | Backend execution concurrency and transient-failure retry limits. |
| `DEMO_MENTOR_EMAIL` / `DEMO_MENTOR_PASSWORD` | Required for seeding only. No default credentials. Password must be at least 10 characters and no more than 72 UTF-8 bytes. |

For Atlas: create a cluster, create a database user with only the access needed for this application, and allow the server's outbound address in Atlas Network Access. Copy the Node.js connection string, use a database name such as `codearena`, and URL-encode special characters in the database username/password. Put that private string in `MONGO_URI`. Keep MongoDB inaccessible to students and avoid exposing port 27017. Do not commit connection strings or use a broad Atlas network allowlist as a permanent deployment shortcut.

## Demo data

No demo credentials are supplied in the repository or the prepared local environment. Supply your own email and strong password through temporary PowerShell environment variables. These prompts keep the password off-screen and out of command history; the `finally` block removes both variables after the seed attempt. Remember your chosen credentials for signing in. Do not put real values into source files or committed configuration.

```powershell
$seedPassword = $null
try {
    $env:DEMO_MENTOR_EMAIL = Read-Host 'Demo mentor email'
    $seedPassword = Read-Host 'Demo mentor password (10+ characters)' -AsSecureString
    $env:DEMO_MENTOR_PASSWORD = [System.Management.Automation.PSCredential]::new(
        $env:DEMO_MENTOR_EMAIL, $seedPassword
    ).GetNetworkCredential().Password
    npm.cmd run seed
} finally {
    Remove-Item Env:DEMO_MENTOR_EMAIL, Env:DEMO_MENTOR_PASSWORD -ErrorAction SilentlyContinue
    if ($seedPassword) { $seedPassword.Dispose() }
    Remove-Variable seedPassword -ErrorAction SilentlyContinue
}
```

[The demo dataset](./server/data/demoQuestions.js) contains exactly 20 Python MCQs (8 easy, 8 medium, 4 hard) covering variables, operators, collections, loops, functions, recursion, strings, slicing, mutability, exceptions, complexity, arrays, searching, sorting, stacks/queues, and debugging. It also includes **Second Largest Distinct Number** and **Balanced Brackets**, with public samples, private weighted edge cases totaling 30 marks per problem, large inputs, and Python reference solutions.

[The seed script](./server/scripts/seed.js) connects to MongoDB and initializes model indexes before writing. It creates a mentor if the email is new. For an existing mentor it verifies the supplied password and never resets it. Questions are reused by mentor, type, and title; existing edits are preserved. The sample contest is reused by mentor and title, regardless of status. New contests are created through the application's contest service, which produces ordered question snapshots and a private room code.

Run one seed process at a time. Repeated sequential runs are non-destructive: they do not delete records, clear student work, reset started contests, or overwrite questions. Renaming a demo question or contest means it will no longer match the seed identity. If preserved question edits no longer satisfy contest validation, repair them in the question bank before retrying. The seed does not print passwords, email addresses, or invitation codes. Sign in using the credentials you supplied, then open the sample contest. Remove seed credentials from long-lived deployment environment settings after use. Never advertise a shared demo login on a public site.

## Conduct a contest

1. Register a mentor or sign in using your privately configured seeded account.
2. Review the question bank. Create or edit MCQs and coding questions; coding hidden case weights must sum to 30.
3. Create a contest with exactly 20 MCQs followed by two coding questions, or open the seeded waiting contest. Enable register numbers when you need stronger classroom identity checks.
4. Share the invitation URL and room code. Students enter their name and, when required, register number. They must join before the contest starts.
5. Confirm attendance and start the contest. The backend stores the start time and all students follow the same schedule. Early MCQ submission locks the answer but does not advance the schedule.
6. Monitor progress and provisional scores. Coding submissions are preserved; the best valid score for each coding question is retained. Review pending submissions and assign manual grades from 0 to 30 when necessary.
7. At completion, finish reviewing pending grades, publish results, and export CSV. Students see the final leaderboard after publication. Create a new contest to conduct another session; seeding does not reset an old contest.

Contest snapshots preserve the selected questions independently of later question-bank edits. Refreshing/reconnecting restores the current server phase and saved work; it does not restart the timer or permit revisiting expired questions. Keep the original student browser session: clearing site data or changing browsers can lose access to its session, and students should not assume they can create a new identity after the contest starts.

## Timers, recovery, and grading

The server checks answer and source changes against persisted `startedAt` and the current server time. The MCQ windows cover seconds 0–899; coding round 1 covers 900–1799; coding round 2 covers 1800–2699. At 2700 seconds the contest ends. Client countdowns use server timestamps for visual synchronization; Socket.IO notifications are not the authority for deadlines.

On restart, reconciliation derives the current phase from persisted timestamps and processes expired coding windows and contest completion. A saved nonempty draft can become a deadline submission if no submission was made for that round. Restarting the server does **not** pause or extend the contest. Work never received by the server before a deadline cannot be recovered as an on-time answer. Keep the host awake, synchronize its clock, and use reliable power/network access.

OnlineCompiler.io receives source code and test inputs from the backend. Public sample runs do not award marks. Hidden cases use the provider's weighted `run-tests` endpoint and award their configured weights, capped at 30 per coding question. Hidden tests, correct MCQ options, and reference solutions remain private to mentors/server code.

If OnlineCompiler.io is unconfigured, unreachable, quota-limited, or fails, submissions remain available for pending manual review; they are never represented as accepted automatically. The mentor reads the immutable submitted source and records a grade. **Never run untrusted student Python in the Express process, a shell, or an ordinary local Python interpreter.** Verify provider quotas, credentials, and availability before a class; source code and test data are sent to that external provider.

## Windows classroom LAN: one URL

Use the built application served by Express so all students use one origin for pages, API requests, and sockets:

```powershell
npm.cmd run build
ipconfig
```

Find the active Wi-Fi/Ethernet adapter's **IPv4 Address**, not a VPN, virtual adapter, or default gateway. If it is `192.168.1.10`, add `http://192.168.1.10:5000` to `CLIENT_ORIGIN` (the address is only an example). Keep `http://localhost:5000` as well if the mentor uses it. Browser origins include the port. Then:

```powershell
npm.cmd start
```

Open `http://YOUR_ACTUAL_LAN_IP:5000` on the host and a second device. Share that same URL with students connected to the same trusted Wi-Fi. Use that URL yourself before copying invitation links so they do not contain `localhost`. The server must listen on a network-accessible interface, normally `0.0.0.0`; `localhost` on a student's device refers to their own device.

For trusted classroom HTTP use, keep `NODE_ENV=development` even when serving the built frontend if production authentication uses Secure cookies. Public production must use HTTPS with `NODE_ENV=production`. Same-origin production/LAN use still requires the exact browser origin in `CLIENT_ORIGIN` for origin checks and Socket.IO access.

If Windows blocks access, mark only your trusted classroom network Private and allow Node.js on Private networks when prompted. Alternatively, an administrator can add a scoped inbound rule in an elevated PowerShell:

```powershell
New-NetFirewallRule -DisplayName 'CodeArena classroom' -Direction Inbound -Protocol TCP -LocalPort 5000 -Action Allow -Profile Private -RemoteAddress LocalSubnet
```

Do not open MongoDB to student devices or configure router port forwarding for a classroom session. Guest Wi-Fi/AP client isolation can prevent device-to-device connections even when the Wi-Fi name matches. Check that isolation, the server's port, the current IPv4 address, and firewall rules if the host works but another device cannot connect. Remove the temporary firewall rule after classroom use if it is no longer needed:

```powershell
Remove-NetFirewallRule -DisplayName 'CodeArena classroom'
```

HTTP LAN mode is intended only for a trusted local classroom; use HTTPS for real public hosting and sensitive network traffic.

## Deployment: Render and Atlas

[render.yaml](./render.yaml) defines one Node web service and no relational database. Connect the repository to Render and apply its Blueprint, or configure a web service manually:

- Build: `npm ci && npm run build`.
- Start: `npm start`.
- Health check: `/api/health`; returns HTTP 200 when MongoDB is connected, or 503 when unavailable.
- Instances: **one**. Use MongoDB Atlas for persistence; do not depend on the hosting filesystem for database storage.
- Set `NODE_ENV=production`, private `MONGO_URI`, a unique `JWT_SECRET` of at least 32 characters, and `CLIENT_ORIGIN=https://YOUR-SERVICE.onrender.com` (or the exact custom-domain HTTPS origin). Render supplies `PORT`.
- Set `TRUST_PROXY=1` behind Render's reverse proxy; the Blueprint includes this setting so Express recognizes the forwarded client address and HTTPS scheme.
- Set the OnlineCompiler variables when available; leave the API key blank to force manual grading. Seed variables are deliberately absent from the Blueprint.

Keep frontend, API, and Socket.IO on the same public HTTPS origin. Ensure the proxy supports WebSocket upgrades and forwards the original scheme correctly for secure cookies. The proxy must replace untrusted forwarded headers and the application should only be reachable through that proxy. `TRUST_PROXY=1` trusts exactly one hop; review the configuration before introducing additional proxies or alternate direct routes, since incorrect trust changes client-IP rate limiting and scheme detection. Leave it disabled for direct classroom LAN hosting. Configure Atlas to permit the service's outbound network access. Use an always-on service for scheduled assessments; sleeping/free instances, deployments, or restarts can interrupt access while the exam clock continues.

For a separate Vercel frontend, deploy the `client/` project and set `VITE_API_URL=https://YOUR-RENDER-SERVICE.onrender.com/api` and `VITE_SOCKET_URL=https://YOUR-RENDER-SERVICE.onrender.com` in Vercel. Set Render `CLIENT_ORIGIN` to the exact Vercel HTTPS URL. The production cookies are Secure and SameSite=None for this cross-origin arrangement; keep both deployments HTTPS and use a single Render instance for the in-process Socket.IO and judging worker.

Do not scale to multiple application instances without adding shared socket coordination, durable judging/job coordination, and a review of concurrent reconciliation. Database persistence alone does not make in-memory sockets and background work safe across replicas. Keep database backups, monitor server/judge errors, and test restore/restart behavior before a live event.

## Commands and verification

| Command | Purpose |
| --- | --- |
| `npm.cmd install` | Install project dependencies for development. |
| `npm.cmd run dev` | Run Vite and the API server together. |
| `npm.cmd run build` | Build the frontend for Express hosting. |
| `npm.cmd start` | Serve the API, sockets, and built frontend, normally on port 5000. |
| `npm.cmd run seed` | Add/reuse the demo mentor, questions, and contest. |
| `npm.cmd test` | Run the repository's automated tests. |

### Verified locally (21 November 2026)

- `npm.cmd run check` passed: production frontend build and **25 passing automated tests**, with one explicit live-provider skip because no API key was configured.
- The integration suite uses real MongoDB, disposable databases, two independent mentors, and 12 simulated student sessions. A controllable server clock exercises all 22 question windows without waiting 45 minutes.
- Covered: authentication and ownership, question validation and snapshots, joins, early MCQ locks, expiry rejection, refresh recovery, unanswered scoring, immutable/idempotent submissions, deadline draft submission, durable-outbox crash recovery, manual grades, best-score retention, ranking, published results, CSV, and authenticated Socket.IO event isolation.
- OnlineCompiler protocol/success/failure handling is tested using controlled HTTP responses. A real unauthenticated request reached the hosted endpoint and returned HTTP 403; full Python execution could not be verified because no `ONLINECOMPILER_API_KEY` was supplied. The live test is explicit and skipped until that key is configured.
- Browser checks passed for mentor login, contest creation with 20+2 questions, student lobby, synchronized start, early answer locking, locally bundled Monaco editing, saved-draft restoration on reload, unavailable-judge feedback, code submission, mentor grading, and results publication. Disposable browser-test records were removed; the seeded sample contest remains waiting.
- The dependency audit reported zero known vulnerabilities after updating React Router. Monaco is loaded lazily and bundled locally; its editor bundle still produces Vite's large-chunk advisory.
- Atlas, Render deployment, real-device classroom Wi-Fi, and a 12-device simultaneous browser/load rehearsal remain unverified. Run those environment-specific checks before a live assessment.

The local setup includes a generated demo mentor password in the ignored root `.env`, under `DEMO_MENTOR_PASSWORD`; its email is `DEMO_MENTOR_EMAIL`. These are local setup values, not public application defaults. New installations must supply their own credentials before seeding.

### Operational limits

Run one application instance. Each student can submit at most 60 distinct code attempts per coding question, with a 32,000-character source limit and six sample runs per minute. Manual grading applies to submissions awaiting manual review; grades are recorded once, and a later weaker attempt does not lower an earlier best score. There is no unsandboxed local Python runner.

The database works with a standalone local MongoDB server as well as Atlas. Critical answer updates are atomic single-document writes. Code submission admission atomically captures source and a receipt in the draft document; a recoverable outbox materializes each receipt into the immutable submissions collection. Derived results can be rebuilt from responses and submissions. This avoids requiring replica-set transactions merely to run a local classroom.

Provider protocol references: [OnlineCompiler Run Code API](https://onlinecompiler.io/docs/run-code), [OnlineCompiler Run Tests API](https://onlinecompiler.io/docs/run-tests), [OnlineCompiler limits and usage](https://onlinecompiler.io/docs/limits), and [Mongoose validation documentation](https://mongoosejs.com/docs/validation.html).

The seed was verified against a separate disposable local MongoDB database: initial creation produced one mentor, 22 questions, and one waiting contest with valid ordered snapshots; a repeat run preserved question edits, finished contest status, and the password hash without duplicating records. Wrong or missing credentials were rejected. The verification database was removed afterward; the application database and other test databases were not used.

Before a classroom event, rehearse with at least two independent student browser sessions. Check join/start, early locks, deadline rejection, refresh recovery, saved drafts, best-score retention, manual grading, results publication and CSV export, and mentor/student access boundaries. Use the automated controllable-clock tests for timer boundaries rather than changing a live server's clock. Conduct a separate capacity rehearsal for the expected class size. Session checks and deadlines enforce assessment rules; they do not guarantee prevention of cheating.

## Source layout

- [client/](./client/) — React interface, router, Socket.IO client, and Python editor.
- [server/config/](./server/config/) — environment and MongoDB configuration.
- [server/models/](./server/models/) — mentor, question, contest, participant, response, draft, submission, and result schemas.
- [server/services/](./server/services/) — contest, timer, grading, and scoring behavior.
- [server/data/demoQuestions.js](./server/data/demoQuestions.js) — private demo content and reference solutions.
- [server/scripts/seed.js](./server/scripts/seed.js) — non-destructive demo seed.
- [server/tests/](./server/tests/) — automated checks; consult the current test suite/report for exact coverage.
- [.env.example](./.env.example) and [render.yaml](./render.yaml) — configuration templates without credentials.
