# Post-Interim Update — Presentation Pack

Delivered: April 2026 · Audience: FITE7001 capstone panel

## Files

| File | Purpose |
|------|---------|
| `slides.md` | Marp-formatted slide deck (7 slides, 16:9) |
| `script.md` | Per-slide presenter script, timed to 4:55 |

## Rendering the slides

The deck is written in [Marp](https://marp.app/) Markdown. To render:

```sh
# One-shot PDF (recommended for handout):
npx @marp-team/marp-cli@latest docs/presentations/post-interim-update/slides.md \
  --pdf --allow-local-files -o slides.pdf

# Live HTML preview while presenting:
npx @marp-team/marp-cli@latest --server docs/presentations/post-interim-update/
```

Alternatively, VSCode with the Marp extension renders it inline — just open `slides.md` and hit the preview button.

## Timing plan

| Slide | Target | Cumulative |
|------:|-------:|-----------:|
| 1. Title | 0:25 | 0:25 |
| 2. Threat model | 0:45 | 1:10 |
| 3. Tier 1 — statistical honesty | 0:55 | 2:05 |
| 4. Tier 2 — robustness pages | 0:45 | 2:50 |
| 5. Walk-forward decay (key) | 0:55 | 3:45 |
| 6. Regime-conditional sizing | 0:40 | 4:25 |
| 7. Verdict + next steps | 0:35 | 5:00 |

Script includes backup answers for the three questions most likely to come up.
