# DPI Financial Reconstruction

Evidence-led reconstruction of Divorce Party International Ltd. at 31 August 2026. The static application presents the three financial statements, supporting schedules, a 100-decision register, the independent two-agent review trail, reconciliations, uncertainties, and board actions.

## Routes

- `/` — full case file
- `/review` — compact assessor view focused on exceptions and material judgments
- `/submission.json` — machine-readable submission

## Local checks

Use Node.js 18 or later.

```sh
npm test
npm run serve
```

The validator checks the 100 required decisions, the 75/25 review split, material-judgment fields, and the balance sheet, cash, and equity reconciliations.

## Deployment

The project is a dependency-free static site configured for Vercel. Import the repository into Vercel with the repository root as the project root and no build command.

