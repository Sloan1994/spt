# Changelog

Newest first. The in-app "What's new" sheet shows every version newer than the last one you opened, from the `CHANGELOG` constant in `src/8-premium.js`.

## 2.3.0

Training optimisation pass, merged with the premium (2.2) and Whoop (2.1) work.

- Training load model: daily lift / conditioning / bowling / Whoop-strain load units, coupled and EWMA ACWR (EWMA is the headline), bands under 0.8 / 0.8 to 1.3 / 1.3 to 1.5 / over 1.5.
- Today: Load tile projects the ratio with the planned session, suggests which accessory sets to trim to stay under 1.3, one-tap "Apply trim".
- Today: Readiness composite (recovery 40, sleep 20, HRV 20, soreness 10, yesterday's load 10) with a component breakdown.
- HRV-guided deload proposal (HRV 7-day under 90% of the 30-day baseline for 3 days, ACWR over 1.5, or soreness 7+ on 3 of 5 days). Shown once per episode, declining snoozes 7 days. Accepting makes the week a deload (2 sets, about 15% lighter, Day C becomes Zone 2).
- Grip dynamometer and single-leg hold check-in fields, 7-day vs best 14-day baseline flag, left/right asymmetry, bowling-side setting.
- Lane-day performance: per-game scores, session kind and pattern, averages by Whoop zone / sleep / legs lifted / ACWR band (5 games per bucket minimum).
- Travel mode: trip planner, 3-days-out to 3-days-back jet-lag protocol, hotel-gym exercise substitutions.
- Sleep regularity index, bedtime anchor and wind-down chip.
- Session density: set timestamps, rest vs prescribed, long-rest nudge, session timing card.
- Voice logging in the set pad (hidden when speech recognition is unsupported).
- Day-type nutrition targets (lift / conditioning / bowling / rest) and food-verdict context (pre-session, rest day).
- Plan: Learn explainers. Progress: ACWR, load, grip, regularity, lanes and timing cards.
- Integration: the morning briefing shows the readiness band and the bedtime anchor; the session recap shows the timing line; the weekly review text appends the ACWR peak and lane insights (1200-character cap, header never cut); re-saving a lane day keeps its scores, session kind and pattern.
- How buttons and cues on every Day C station (Row, Sled pull, walking lunge, wall balls, KB swing, Run).
- What's new now lists every version newer than the one you last saw.
- Test data: `localStorage['spt-opt-mock']='1'`, scenario via `spt-opt-mock-scenario` (steady, caution, spike, hrv).

## 2.2.0

Premium feature pass.

- Morning briefing: last night's sleep, today's plan and one coaching line, once a day.
- Adherence ring with check-in and session streaks on Today.
- Session recap with PRs, a soreness outlook and a shareable image.
- Haptics and a rest-timer chime. Both switch off in Plan.
- Last session's set shows behind each set, with a marker when you beat it.
- Smarter swaps: like-for-like exercises first.
- Log lane days: games, hours and how the arm, wrist and thumb felt.
- Weekly review you can copy straight to your coach.
- Video and cues on every exercise.
- Back up to Google Drive from Plan.
- New app icon (deep green, white SPT, orange bar), including a maskable icon.

## 2.1.0

Whoop integration.

- Whoop on Today: recovery, HRV, resting HR, sleep and yesterday's strain, with one line of coaching.
- Connect Whoop from Plan through your own Cloudflare Worker (`worker/`). Pull down on Today to sync.
- Train shows the recovery chip and holds suggested loads on red days.
- Check-in fills sleep hours and resting HR from Whoop. Anything you type stays.
- Progress charts for recovery, HRV and recovery against soreness. Weekly cards show average recovery and HRV.
- Test data: `localStorage['spt-whoop-mock']='1'`.

## 2.0.2

- Use the dynamic viewport height so the Safari toolbar gap disappears.

## 2.0.1

- Default to the dark theme.

## 2.0.0

- Ground-up rebuild: per-screen rendering, offline service worker, dark mode, Block 1 Rebuild programme, barcode food verdicts.
