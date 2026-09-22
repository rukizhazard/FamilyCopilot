# Internal demo image references

## Matchup update, 20 September 2026

The owner requested a two-team preview matching the official game page. The
basketball media area now combines the existing DEA logo with
[formosa-dreamers.webp](formosa-dreamers.webp), Chinese team names, AWAY/HOME,
GAME 5, and the card's own date/start time. The
[official game 27539 page](https://tpbl.basketball/schedule/27539) was checked on
20 September 2026 and confirms Dreamers away, DEA home, 10/10 17:00 and GAME 5.
This metadata check does not refresh the older schedule snapshot or verify
ticket availability, end time or calendar compatibility. No calendar-write control
from the reference screenshot was reproduced.

Opponent logo source:
<https://assets.tpbl.basketball/frontend/_nuxt/dreamers.8uP5AliT.webp>

SHA-256: `7d7aa1b0a9f3d49f48031f326066accb5c097c0faac6a3e62031a691211088cc`.
Original 28,648-byte WebP, visually inspected, displayed without cropping.
Copyright remains with the respective rights holders; public reuse authorization
is still unconfirmed. This is the same internal-demo scope, not a free-license claim.
Producer must also include `activity-preview/chat-assets/formosa-dreamers.webp`
in a subsequent approved scenario's `extraAssets`. Existing snapshots and videos
were not changed. The historical three-image inventory below predates this update.

Scope approved by the owner on 20 September 2026: the CTBC DEA logo and the
Forgotten Island and Chiikawa posters for the existing offline demo cards only.
This is permission to integrate the references, not a copyright license from
their rights holders. Public reuse permission remains unconfirmed. Do not describe
these files as freely licensed or publish a website/video containing them without
resolving the relevant rights. Internal use alone is not a legal exemption.
No endorsement is implied. CTBC Brothers has no card and no image is included.

Downloaded and visually inspected on 20 September 2026. Original bytes are kept;
the UI scales with `object-fit: contain`, without cropping or modifying artwork.
Image sources and the unresolved rights status appear in each card's source details.
Public activity `thumbnail` fields remain null: these are presentation references
from a fixed local allowlist, not newly licensed source facts or live retrievals.

| Local file | Source | Rights status |
| --- | --- | --- |
| [ctbc-dea.png](ctbc-dea.png) | [Wikipedia file description](https://zh.wikipedia.org/wiki/File:%E6%96%B0%E5%8C%97%E4%B8%AD%E4%BF%A1%E7%89%B9%E6%94%BB.png), [official club](https://ctbcdea.com.tw/) | Non-free logo. Wikipedia's article-specific fair-use rationale is not a reuse license. |
| [forgotten-island.jpg](forgotten-island.jpg) | [Vieshow film 8956](https://www.vscinemas.com.tw/vsweb/film/detail.aspx?id=8956), [original image](https://www.unicornpopcorn.com.tw/ForVsWeb/upload/film/film_20260907007.jpg) | Copyright retained by the respective rights holders; reuse license not established. |
| [chiikawa.jpg](chiikawa.jpg) | [Vieshow film 8786](https://www.vscinemas.com.tw/vsweb/film/detail.aspx?id=8786), [original image](https://www.unicornpopcorn.com.tw/ForVsWeb/upload/film/film_20260604010.jpg) | Copyright retained by the respective rights holders; this is a poster, not the Commons PD-textlogo. |

Original logo download:
<https://upload.wikimedia.org/wikipedia/zh/f/f6/%E6%96%B0%E5%8C%97%E4%B8%AD%E4%BF%A1%E7%89%B9%E6%94%BB.png>

## SHA-256

```text
819f386bc0b22ab06f73e7d222696b1dc882b5deeeb17f85f7be528b24ac8ffd  ctbc-dea.png
b31bab62bf87ae3217f79b4cfdde3c4222e55bf662769bd767d1e89462082ca3  forgotten-island.jpg
74dcec47ef3b1c4d7e336012ec16bd2d2f1ebbcb0bd7f9c878d5fcf9c9a7eb6a  chiikawa.jpg
```

## Preview and Producer handoff

After explicit owner approval on 20 September 2026, the isolated preview was
restarted using `node scripts/serve-chat-preview.js 34393`. All three image paths
returned 200 with correct MIME types and bytes identical to these files.
The offline 1440px browser workflow passed image decoding and containment checks;
screenshots in `browser-artifacts/chat-preferences-1sHTlV/` were inspected.
Its Linux font still lacks CJK glyphs. Calendar services and videos were untouched.
Future restarts or browser captures require their own scoped approval.

For a subsequently approved immutable demo snapshot, Producer must explicitly add
these three paths to its scenario's `extraAssets`, and retain this notice alongside
the private production record:

```json
[
  "activity-preview/chat-assets/ctbc-dea.png",
  "activity-preview/chat-assets/forgotten-island.jpg",
  "activity-preview/chat-assets/chiikawa.jpg"
]
```

No snapshot, media helper, scenario, recording, narration or existing video was
changed in this increment. Packaging and public release require their own review.