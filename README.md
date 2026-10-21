# Blind side

## Hackathon demo

**Try it:** https://majordev77.github.io/Blind-side/. Open it on a phone, put on headphones and tap **Try the demo**.

Blind Side lets a blind or low-vision fan follow football through headphones. A 3D tone follows the ball between your ears, short sounds mark passes, shots and the crowd, and a voice speaks only for what matters. The demo recreates Cristiano Ronaldo's overhead kick for Real Madrid at Juventus (Champions League quarter-final, 3 April 2018) in 36 seconds.

- **Start** unlocks sound inside the tap, as iPhone Safari and Android Chrome require, and no sign-in is needed.
- **Speakers mode** exaggerates left and right for when you have no headphones.
- **Show me what I heard** shows the ball live on a 2D pitch, alongside the sound.
- **Personalise** changes the commentary: English, Nigerian Pidgin or Yoruba (captions); essentials, full or analyst; and a favourite player, who gets a chime.
- **Tap a caption** to see the match events that prove it.

The commentary is AI-drafted, then checked by a deterministic verifier: `scripts/commentary/` (Editor → Narrator → Verifier). The verifier rejects any line whose names, scores or minutes it can't trace to event IDs. Run `python scripts/commentary/pipeline.py --selftest` to watch it reject wrong lines.

**Rights.** The sound and commentary are a recreation from public match reports (sources in `docs/pitch/FACTS.md`). The video on the demo page is Real Madrid's official upload, embedded with YouTube's own player and muted: nothing is downloaded, copied or committed, and it needs internet. Delete `officialVideo` from the clip JSON to switch it off (the Microsoft hackathon build must). There is no broadcast audio, crest or image. Every sound is synthesised in the browser with the Web Audio API, and the voice is the browser's own text-to-speech. The recreation lives in `frontend/src/demo/bicycle-kick-2018.json`, so it can be swapped for an invented match.

**Offline:** `docs/pitch/blind-side-standalone.html` opens by double-clicking. Running it from a laptop is covered in `docs/pitch/DEMO-RUNBOOK.md`.

**Where it lives:**
- `frontend/src/pages/listen/` is the demo page.
- `frontend/src/audio/` is the sound engine.
- `frontend/src/demo/` holds the match data and commentary.
- `docs/pitch/` holds the pitch script, slides, runbook and facts.

## What this is built with

The whole product: an API and the screens that use it.

- **Django** with **Django REST Framework** for the API.
- **SimpleJWT** for authentication, against a custom user model in `apps/users`.
- **drf-spectacular** for the OpenAPI schema, served at `/api/schema/` and browsable at `/api/docs/`.
- **React** with **Vite** for the dev server and the build.
- **Chakra UI** for components, and **React Router** for routes.
- **TanStack Query** for every call to the API, so caching and refetching are decided in one place.

## Setting it up

You need the CLI once: `npm install -g blacksmith-cli`.

```bash
blacksmith setup     # dependencies, database, migrations
blacksmith dev       # start it
```

The API answers on `http://localhost:8000`, and the app on `http://localhost:5173`.

Copy `backend/.env.example` to `backend/.env` before the first run. It is ignored by git and holds the secret key, the database URL and anything else this project should not carry in its history.

## Where the code lives

```
backend/
├── config/
│   ├── settings/        # base, development, production
│   └── urls.py          # where routes are mounted
├── apps/
│   └── users/           # the custom user model, and auth
├── utils/               # shared helpers, base model
├── manage.py
└── requirements.txt

frontend/
└── src/
    ├── api/
    │   ├── generated/   # written by `blacksmith sync` — do not edit
    │   └── hooks/       # your queries and mutations
    ├── pages/           # one folder per page
    ├── features/        # auth, and anything else that spans pages
    ├── router/          # routes and layouts
    ├── shared/          # components and hooks used across pages
    └── styles/
```

## Day to day

| Command | What it does |
| --- | --- |
| `blacksmith dev` | Run it locally. |
| `blacksmith sync` | Regenerate the frontend API types and hooks from the backend schema. Run it after changing a serializer or a route. |
| `blacksmith make:resource Post` | Scaffold a model, serializer, viewset and routes, plus the hooks and pages that use them. |
| `blacksmith backend <command>` | Run a Django management command, e.g. `blacksmith backend createsuperuser`. |
| `blacksmith frontend <command>` | Run an npm command in the frontend, e.g. `blacksmith frontend install axios`. |
| `blacksmith eject` | Remove Blacksmith and keep a plain Django and React project. Nothing here is a dependency on us. |
