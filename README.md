# OMNISCIENT — XAU/USDT Multi-Timeframe Scalping Terminal

A Bloomberg-style gold scalping terminal for the **XAU/USDT** perpetual, built with Next.js and
powered entirely by **real OKX exchange data** — live ticker, order book, candles and derivatives.

## Features

- **Eight timeframes**: 1m, 3m, 5m, 15m, 30m, 1H, 2H, 4H — each with its own independent signal engine.
- **Multi-timeframe signal matrix**: every timeframe shows its direction, ideal entry, stop loss,
  target 1, target 2 and agreement score at a glance. Click any row to switch the whole terminal.
- **Immutable signal lock**: once a setup confirms on a *closed* candle its direction, entry, stop
  and targets are frozen — never rewritten while the lock lives. Every lock carries a deterministic
  id built from the timeframe and the confirmation close time.
- **Closed-candle intelligence**: live quotes never rewrite a confirmed direction.
- **Real-time WebSocket feed**: ticker, order book and all eight candle streams update live, with
  REST recovery as a fallback.
- **Indicators**: EMA 21/50, Wilder RSI 14, ATR 14, rolling VWAP, MACD 12/26/9 and market structure.
- **Market microstructure**: mark price, funding rate, open interest and contract metadata.
- **Risk calculator**: position sizing from verified contract sizes.

## Data source

OKX (`XAU-USDT-SWAP`) is the selected feed. It is the only venue tested that serves the exact
XAU-USDT perpetual across **all eight** requested timeframes natively.

Binance and Bybit return HTTP 451 (region-restricted) from this deployment and are therefore not
selectable. MEXC, Bitget and Gate are benchmarked on the **Market data** tab but are not used for
prices, so charts, tick sizes and signals never mix different markets.

## Getting started

Clone and run the exact same terminal:

```bash
git clone https://github.com/mauryapankaj8225-sys/Molahodert.git
cd Molahodert

# pnpm (recommended — the repo ships a pnpm-lock.yaml)
corepack enable
pnpm install
pnpm dev

# or npm
npm install
npm run dev
```

Open http://localhost:3000.

No API keys or configuration are required — the terminal reads only public OKX market data
endpoints, so it works out of the box with no `.env` file.

Production build:

```bash
pnpm build && pnpm start
```

## Disclaimer

Designed for discipline, not certainty. No signal guarantees profit. Factor agreement is not a
probability of profit. This terminal does not place trades. Trade only with capital you can afford
to lose.
