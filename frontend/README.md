# CLOU Frontend

React + TypeScript web UI for CLOU.

## Requirements

- [fnm](https://github.com/Schniz/fnm) or [nvm](https://github.com/nvm-sh/nvm) for Node.js version management

## Setup

```bash
cd frontend
fnm install && fnm use  # or nvm install && nvm use
npm install
npm run dev
```

Open http://localhost:5173

## Code Structure

| Directory | Purpose |
|-----------|---------|
| `src/` | Main source code |
| `src/client/` | Generated OpenAPI client |
| `src/components/` | UI components |
| `src/hooks/` | Custom React hooks |
| `src/routes/` | Page routes |

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run lint` | Run Biome linter |

## License

Licensed under the Apache License 2.0. See [LICENSE](../LICENSE) file for details.