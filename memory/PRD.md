# Aida (Аида) — Personal Health Companion

## Original Problem Statement
Aida helps a person build a holistic picture of their health over time. The user gradually creates a digital health history; AI structures data, notices changes, explains relationships, prepares information for a doctor, and suggests safe next actions. Aida does not replace a doctor and never invents diagnoses. Modules: personal health card, lab upload+OCR, symptom diaries, medications, AI assistant (Aida), doctor report, customizable "Puzzle" dashboard, soft gamification (XP/level/companion), family profile switching (Me/Child/Relative), analytics readiness.

## User Choices (MVP)
- Modules: all base modules (profile, labs+AI, symptoms, meds, doctor report, AI chat, puzzle widgets, XP/companion)
- AI engine: Gemini 3 Flash (gemini-3-flash-preview) via Emergent Universal LLM key
- Auth: skipped (demo mode, auto-seeded profiles)
- Family: profile switching Me/Child/Relative included; geolocation + wearables (Apple Watch/Xiaomi) deferred to v2
- Language: RU + EN toggle

## Architecture
- Frontend: Expo Router (React Native), 4 tabs (Puzzle Home / Timeline / Aida Chat / Profile) + modal Doctor Report
- Backend: FastAPI + MongoDB (motor), all routes under /api
- AI: emergentintegrations LlmChat with Gemini 3 Flash (chat, lab OCR via FileContentWithMimeType, report summary)
- i18n: custom RU/EN provider (src/i18n.tsx); theme: warm "Hand-Drawn Journal" palette (sage/oat/terracotta), Fraunces-style serif headings + sans body
- State: AppProvider (profiles + active profile), LogProvider (global add sheets + toast)

## Personas
- Self-tracker managing own health timeline
- Parent managing a child's separate profile
- Caregiver for an elderly relative
- People with chronic conditions preparing for doctor visits

## Implemented (2026-08-14)
- Profiles CRUD + switcher (Me/Child/Relative) with avatars
- Puzzle Home: customizable widgets (companion, readiness, next med, recent symptom, latest lab, quests, quick note) with toggle persistence
- Analytics readiness progress + gamification (XP, levels, quests, companion mood)
- Health Timeline: filter chips, accordion lab results with out-of-range signal colors, symptom/med entries, delete
- Lab upload: camera / gallery / PDF → Gemini OCR → structured biomarkers + AI summary (with permission handling + settings redirect)
- Symptom diary (severity 1–10, note) and Medications (dose/schedule) via bottom sheets
- Aida AI chat: context-aware (profile + meds + symptoms + labs), RU/EN, persisted history, starters
- Doctor report: period selector (30/90/365d), facts (allergies, chronic, meds, symptoms, labs) separated from AI observations
- RU/EN language toggle (top bar + profile settings)
- Keyboard handling via react-native-keyboard-controller

## Backlog / Remaining
- P1: Personal baseline detection & change alerts; lab biomarker trend charts (time series per marker)
- P1: Women's health module (cycle, pregnancy), men's health module
- P1: Sharing & permissions between family accounts; emergency medical card
- P2: Wearables (Apple Watch/Xiaomi/HealthKit) integration; geolocation & safety (SOS/fall)
- P2: Authentication (accounts) to replace demo mode
- P2: Companion cosmetics shop (spend XP)

## Next Tasks
- Add trend charts for repeated lab biomarkers
- Add women's/men's health puzzle modules
