# transfarm-services

Firebase Cloud Functions backend for the TransFarm (Farmarga) app. Each backend
capability lives as an independent feature module under `functions/src/features/`,
so new services can be added without touching existing ones.

## Project layout

```
functions/
  src/
    common/                 # shared infra: secrets, HTTP client, etc.
    features/
      mandi-market/         # Mandi market price proxy (data.gov.in)
    index.ts                # re-exports all deployed functions
```

## Prerequisites

- Node.js 24 (matches the `engines` field in `functions/package.json` and the
  Cloud Functions `nodejs24` runtime)
- Firebase CLI (`npm i -g firebase-tools`), logged in via `firebase login`
- Access to the `transfarm-app` Firebase project (see `.firebaserc`)

## Setup

```bash
cd functions
npm install
```

## Mandi market prices (`getMandiMarketPrices`)

A callable Cloud Function the Flutter app invokes to fetch normalized mandi
(market) prices. It queries data.gov.in, preferring the newer "Variety-wise
Daily Market Prices Data of Commodity" dataset and transparently falling back
to the older, more stable "Current Daily Price of Various Commodities from
Various Markets (Mandi)" dataset if the primary one errors out (it has been
reported to intermittently 502). Both datasets are normalized into one
consistent response shape before returning to the client.

Request fields (all optional except pagination defaults):

| Field         | Type   | Notes                              |
| ------------- | ------ | ----------------------------------- |
| `state`       | string |                                     |
| `district`    | string |                                     |
| `market`      | string |                                     |
| `commodity`   | string |                                     |
| `variety`     | string |                                     |
| `arrivalDate` | string | Format `DD/MM/YYYY`                |
| `limit`       | number | Default 100, max 500               |
| `offset`      | number | Default 0                          |

Response shape:

```jsonc
{
  "source": "primary" | "fallback",
  "count": 42,
  "records": [
    {
      "state": "Karnataka",
      "district": "Bengaluru",
      "market": "Binny Mill (F&V)",
      "commodity": "Tomato",
      "variety": "Hybrid",
      "grade": "FAQ",
      "minPrice": 800,
      "maxPrice": 1200,
      "modalPrice": 1000,
      "arrivalDate": "18/09/2026"
    }
  ],
  "fetchedAt": "2026-09-19T10:00:00.000Z"
}
```

### API key

The data.gov.in API key is stored in Firebase Secret Manager and is never
shipped in the Flutter app. Set it once per environment:

```bash
firebase functions:secrets:set DATA_GOV_API_KEY
```

For local emulation, create `functions/.secret.local` (already gitignored):

```
DATA_GOV_API_KEY=your-dev-key
```

## Local development

```bash
cd functions
npm run build:watch   # in one terminal
npm run serve         # builds once and starts the emulator
```

## Deploying

```bash
cd functions
npm run deploy
```

`firebase.json` runs `lint` and `build` automatically as predeploy steps.
