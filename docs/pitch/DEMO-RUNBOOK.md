# Demo runbook: Blind Side on stage

Pitch 10:00 WAT. Do this checklist from 09:15. Script: `PITCH.md`.

## Pre-stage checklist

- [ ] Phone charged above 80%, charger and cable in your pocket.
- [ ] Battery saver and Low Power Mode **off** (they can stop audio).
- [ ] Do Not Disturb **on**, so no calls or notifications interrupt the clip.
- [ ] iPhone: silent switch **off** (on silent, iPhone mutes web audio).
- [ ] Media volume up. Play the clip once at the venue and set the level so the applause isn't distorted.
- [ ] Bluetooth speaker or venue audio connected and tested with the real clip, not just a ringtone.
- [ ] Page preloaded in the browser, Start button showing. Screen auto-lock set to 10 minutes or "never".
- [ ] **Speakers mode ON** (venue speakers, no headphones).
- [ ] Personalise reset to English, Full, no favourite player (the pitch changes it live).
- [ ] Airplane-mode test: turn on airplane mode, reload, tap Start, check sound and voice. Then turn it off again (or leave it on if Wi-Fi is bad).
- [ ] Backup laptop: the live page open in a browser tab, with sound tested through the venue audio.
- [ ] Standalone HTML file saved on the laptop desktop, opened once to check it plays.
- [ ] Backup screen recording of the full demo saved on the phone **and** the laptop:
  - Android: swipe down twice, tap **Screen record**, choose "Media sounds", start, run the demo.
  - iPhone: open Control Centre, tap **Screen Recording** (add it in Settings > Control Centre if missing), run the demo.
  - Play the recording back: on some phones the text-to-speech voice is not captured. If so, record the laptop instead.

## What to do if...

| Problem | What to do |
|---|---|
| No sound at all | Check the silent switch and media volume. Check the speaker is connected (Bluetooth icon). Tap Start again. Still nothing in 15 seconds: switch to the laptop tab through venue audio. |
| Sound plays but the voice doesn't speak | Captions still show, so carry on and read the key line aloud yourself. Afterwards, check phone settings > text-to-speech has a voice installed. Laptop is the backup. |
| Wi-Fi down | The page is already loaded and runs on the phone, so keep going. If you must reload, use the standalone HTML on the laptop. |
| Site won't load | Open the standalone HTML on the laptop. Last resort: play the backup screen recording. |
| Wrong voice or accent | Keep going and say: "It uses whatever voice your phone has." Don't fix settings on stage. |
| Phone dies | Laptop tab or standalone HTML through venue audio. Say: "Same app, on a laptop." |
| Projector doesn't show the phone | Don't fight the cable. The demo is audio: ask the room to close their eyes. Hold up the phone for the 2D pitch, or show it on the laptop tab. |
| A judge asks to try it themselves | Yes. Hand over the phone with headphones if you have them, Speakers mode off, tap Replay for them. Or give the live link to open on their own phone. |

## Commands

Three ways to run the demo. Use them in this order: if one fails, move to the next.

### 1. The live link (normal case)

- Landing page: **https://majordev77.github.io/Blind-side/**
- Demo directly: **https://majordev77.github.io/Blind-side/listen**

The capital **B** in `Blind-side` matters. Open the link once before you go on stage, so the page is already loaded. After it has loaded once, the demo itself needs no network: everything is in the page.

### 2. Your laptop serves it to your phone (venue Wi-Fi is down)

This runs the built app on your laptop and opens it on your phone over your phone's hotspot. Do it once tonight to practise.

1. Turn on your phone's **hotspot** and connect the laptop to it.
2. In VS Code, open a terminal (**Terminal → New Terminal**, PowerShell) and run:

   ```powershell
   cd "C:\Users\BUKOLA KAYODE-OJO\blind-side\frontend"
   npm run build
   npx vite preview --host --port 4173
   ```

   `npm run build` makes the production files in `frontend/dist`. `vite preview --host` serves them to other devices on the same network, not just this laptop.
3. The terminal prints two addresses. Use the **Network** one, for example `http://10.178.91.174:4173/`. Your number will differ on the hotspot. On your phone, open that address followed by `listen`, for example `http://10.178.91.174:4173/listen`.
4. If Windows asks whether Node.js may use the network, choose **Private networks** and **Allow**.
5. Press **Ctrl+C** in the terminal to stop it.

If the phone can't reach it, the hotspot may be blocking devices from talking to each other. Use option 3 instead.

### 3. The single offline file (no network at all)

- File: `C:\Users\BUKOLA KAYODE-OJO\blind-side\docs\pitch\blind-side-standalone.html`
- Double-click it in File Explorer. It opens in your browser with no network, and all the code is inside the file.
- To put it on your phone, send the file to yourself (USB cable, Bluetooth, or a message to yourself) and open it in Chrome (Android) or Files → Safari (iPhone). **Test this tonight.** Some phones won't open local HTML files well, so the laptop is the safer place for this file.
- If anyone changes the app or commentary, rebuild the file:

  ```powershell
  cd "C:\Users\BUKOLA KAYODE-OJO\blind-side\frontend"
  npm run build:standalone
  ```

### Regenerating the commentary (only if you change a line)

```powershell
cd "C:\Users\BUKOLA KAYODE-OJO\blind-side"
python scripts/commentary/pipeline.py            # Editor, Narrator, Verifier → frontend/src/demo/commentary.json
python scripts/commentary/pipeline.py --selftest # shows the verifier rejecting wrong lines (good for judges)
```

To change a line, edit `scripts/commentary/drafts.json`, run the pipeline, and read `scripts/commentary/last-run.md` to confirm the verifier accepted it. Then rebuild (option 2 or 3) or push to redeploy the live link.
