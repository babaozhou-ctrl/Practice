# Contributing

Thanks for taking a look at Deep Pet.

This project cares as much about feel as it does about features. A change is only successful if it keeps the companion calm, readable, and pleasant to live with over long sessions.

## Before You Open A Change

- read [README.md](./README.md) for the current product direction
- skim [docs/specs/product-architecture.md](./docs/specs/product-architecture.md)
- keep Mochi as the current built-in reference companion

## What We Prioritize

- motion quality over quick visual hacks
- context-aware behavior over noisy notifications
- modular systems over one-off shortcuts
- small, understandable public commits

## Local Checks

Run these before opening a public change:

```bash
npm run typecheck
npm run build
```

If pet assets changed, also run:

```bash
npm run qa:mochi
```

## Style Notes

- keep the desktop pet runtime lean
- avoid unnecessary React rerenders in pet-adjacent flows
- prefer typed boundaries between Electron and renderer code
- do not reintroduce old catgirl naming in new code or docs
- avoid hypey product copy and exaggerated capability claims

## Pull Request Scope

- keep changes focused
- explain user-facing behavior changes clearly
- include screenshots or motion capture when visual behavior changes
- call out any unfinished edges instead of hiding them
