# Compile and Run Instructions

This document explains how to install, compile, and run the FITE7001 Group 13 PM Arbitrage web application from the public GitHub repository.

Live app: https://pmv12.vercel.app/

GitHub repository: https://github.com/cheungringo420/FITE7001_2026_Group13

## 1. Prerequisites

Install the following before running the project:

- Git
- Node.js 20.9.0 or later
- npm 10 or later
- Python 3.10 or later, only for the optional research/backtest scripts

The submitted project was locally checked with:

```bash
node -v   # v22.14.0
npm -v    # 10.9.2
```

## 2. Clone the Repository

```bash
git clone https://github.com/cheungringo420/FITE7001_2026_Group13.git
cd FITE7001_2026_Group13
```

## 3. Install Dependencies

Use `npm ci` so dependencies are installed exactly from `package-lock.json`:

```bash
npm ci
```

If `npm ci` is not available in the local environment, use:

```bash
npm install
```

## 4. Configure Environment Variables

Create a local environment file:

```bash
cp .env.local.example .env.local
```

The default `.env.local.example` values are sufficient for the public demo mode:

```bash
FEATURE_LABS=false
NEXT_PUBLIC_FEATURE_LABS=false
FEATURE_SYNTHETIC=false
NEXT_PUBLIC_FEATURE_SYNTHETIC=false
EXECUTION_MODE=paper
NEXT_PUBLIC_EXECUTION_MODE=paper
```

`OPENAI_API_KEY` is optional. If it is not provided, the app falls back to local/text-based matching.

Important: keep `EXECUTION_MODE=paper` for review/demo use. Do not commit a real API key or any private credentials.

## 5. Run in Development Mode

```bash
npm run dev
```

Open the app at:

```text
http://localhost:3000
```

If port 3000 is already occupied:

```bash
npm run dev -- -p 3001
```

Then open:

```text
http://localhost:3001
```

## 6. Compile the Production Build

Run:

```bash
npm run build
```

This creates an optimized Next.js production build in `.next/`.

The production build was verified locally on May 1, 2026 and completed successfully.

## 7. Run the Compiled Production App

After `npm run build` finishes, run:

```bash
npm run start
```

Open:

```text
http://localhost:3000
```

If port 3000 is already occupied:

```bash
npm run start -- -p 3001
```

## 8. Validate the Project

Use these commands to check the project:

```bash
npm run lint
npm run build
```

`npm run build` is the main compile command required for submission.

## 9. Main Web Pages

After the app starts, these routes are available:

- `/` - market discovery dashboard
- `/compare` - market comparison
- `/arbitrage` - arbitrage opportunities
- `/trust` - trust score and resolution-risk view
- `/correlation` - cross-asset correlation scanner
- `/options` - options and prediction-market analysis
- `/research` - research overview
- `/backtest` - backtest dashboard
- `/research/backtest` - research backtest results

## 10. Optional Python Research and Backtest Scripts

The Next.js web app does not require Python to run. Python is only needed if reviewers want to regenerate local research data, alpha signals, or backtest outputs.

Create and activate a Python virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Install script dependencies:

```bash
pip install -r scripts/requirements.txt
```

Run the alpha scanner:

```bash
python3 scripts/alpha_scanner.py
```

Run the trust-score backtest:

```bash
python3 scripts/run_backtest.py
```

The alpha scanner writes `data/alpha_signals.json`, which is served by `/api/signals`. Backtest outputs are used by the research/backtest pages.

## 11. Troubleshooting

If dependencies fail to install, confirm the Node.js version is 20.9.0 or later:

```bash
node -v
```

If the app starts but market data does not load, confirm internet access is available because the app fetches live public market data from external market APIs.

If port 3000 is busy, use port 3001:

```bash
npm run dev -- -p 3001
```

If semantic matching is unavailable, leave `OPENAI_API_KEY` empty or unset; the app still runs with fallback matching.
