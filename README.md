# PM Arbitrage

FITE7001 Group 13 prediction-market intelligence web app.

The application helps users browse and compare prediction markets, identify cross-platform arbitrage opportunities, inspect trust and resolution-risk signals, and review backtesting research results.

Live deployment: https://pmv12.vercel.app/

Public repository: https://github.com/cheungringo420/FITE7001_2026_Group13

## Tech Stack

- Next.js 16.1.4
- React 19.2.3
- TypeScript
- Tailwind CSS 4
- Polymarket and Kalshi market-data integrations
- Optional OpenAI semantic matching for stronger market comparison
- Optional Python research scripts for signal scanning and backtesting

## Compile and Run

Full submission instructions are available in [docs/COMPILE_AND_RUN.md](docs/COMPILE_AND_RUN.md).

### Prerequisites

- Node.js 20.9.0 or later
- npm 10 or later
- Git
- Python 3.10 or later, only if running the optional research/backtest scripts

The project was locally verified with Node.js 22.14.0 and npm 10.9.2.

### Quick Start

```bash
git clone https://github.com/cheungringo420/FITE7001_2026_Group13.git
cd FITE7001_2026_Group13
npm ci
cp .env.local.example .env.local
npm run dev
```

Open http://localhost:3000 in a browser.

### Compile for Production

```bash
npm run build
```

### Run the Compiled App

```bash
npm run start
```

Open http://localhost:3000 in a browser. If port 3000 is already in use, run:

```bash
npm run start -- -p 3001
```

### Useful Commands

```bash
npm run dev      # Start local development server
npm run build    # Compile an optimized production build
npm run start    # Serve the compiled production build
npm run lint     # Run ESLint
```

## Environment Variables

Create `.env.local` from `.env.local.example` before running the app:

```bash
cp .env.local.example .env.local
```

For the basic web-app demo, the default values are enough. If an OpenAI API key is provided, semantic matching is enabled; otherwise the app falls back to local/text-based matching.

Do not commit real API keys.

## Main Pages

- `/` - market discovery dashboard
- `/compare` - cross-market comparison
- `/arbitrage` - arbitrage scanner
- `/trust` - trust and resolution-risk view
- `/correlation` - cross-asset correlation scanner
- `/options` - options and prediction-market comparison
- `/research` - research overview
- `/backtest` and `/research/backtest` - strategy/backtest results

## Optional Python Research Scripts

The web app runs without these scripts, but they can refresh local research outputs:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r scripts/requirements.txt
python3 scripts/alpha_scanner.py
python3 scripts/run_backtest.py
```

Generated outputs are read by routes such as `/api/signals` and the research/backtest pages.
