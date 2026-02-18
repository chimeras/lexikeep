# LexiKeep Project Tracker

Last updated: 2026-02-15 (AI generation + word images + teacher dictionary controls)

## Status Legend
- `todo`
- `in_progress`
- `blocked`
- `done`

## Current Goals
- Build a fun, mobile-first student learning experience.
- Build a separate teacher/admin control dashboard.
- Improve learning outcomes with quests, reviews, and contextual practice.
- Complete authentication MVP (register/login/logout + route guards + role redirects).
- Keep project tracker aligned with implemented features and DB rollout status.

## Phase Tracker

| ID | Phase | Task | Status | Owner | Notes |
|---|---|---|---|---|---|
| A-01 | Foundation | Register with Supabase Auth + profile row creation | done |  |  |
| A-02 | Foundation | Login with role-based redirect | done |  |  |
| A-03 | Foundation | Logout from navbar (mobile + desktop) | done |  |  |
| A-04 | Foundation | Middleware route guards for protected pages | done |  |  |
| A-05 | Foundation | Admin route protection (`/admin/*`) for role != student | done |  |  |
| P1-01 | Quick Wins | Daily hook cards (`Word of the Day`, `Expression Challenge`) | done |  | Dashboard UI + data helper added |
| P1-02 | Quick Wins | Weekly quest cards with progress | done |  | Progress bars wired to student metrics |
| P1-02a | Quick Wins | Teacher CRUD for daily challenges + weekly quests | done |  | Implemented on `/admin/dashboard` |
| P1-02b | Quick Wins | Admin page sidebar/tabbed organization | done |  | Single active section view with nav |
| P1-03 | Quick Wins | Badge MVP (5-8 badges) | done |  | Student badge shelf added on dashboard (rule-based MVP) |
| P1-04 | Quick Wins | Points rebalance for quality learning | done |  | Save rewards + quiz bonus points wired |
| P1-05 | Quick Wins | Post-submit educational micro-feedback | done |  | Micro-lesson + mini quiz after save |
| P1-06 | Quick Wins | Supabase tables for quests/badges/challenges | in_progress |  | Quests/challenges live; badges code wired, awaiting badge SQL execution |
| P2-01 | Core Features | Spaced repetition review queue | done |  | `review_items` schema + `/review` flow + rating updates + points |
| P2-02 | Core Features | Context scoring for original sentence usage | done |  | Heuristic scoring + feedback + bonus points in collector |
| P2-03 | Core Features | Duel mode (1v1 timed challenge) | done |  | Schema + duel arena flow + finish rewards + history/rematch |
| P2-04 | Core Features | Team leaderboard | in_progress |  | Team leaderboard + admin team CRUD/membership UI wired; SQL policy patch pending |
| P2-05 | Core Features | Teacher boosts (`Double XP`) | in_progress |  | Admin boost CRUD + boosted point awards + student boost banner wired; DB rollout pending |
| P3-01 | Advanced | Pronunciation practice + attempt scoring | blocked |  | Deferred for live class delivery |
| P3-02 | Advanced | Adaptive recommendations | todo |  |  |
| P3-03 | Advanced | AI tutor hints and corrections | todo |  |  |
| P3-04 | Advanced | Teacher analytics dashboards | in_progress |  | Review adoption + top materials usage + top teams insights live |
| P3-05 | Advanced | Seasonal event tournaments | todo |  |  |
| UX-01 | Engagement | Points-based level progression system | done |  | Levels + progress bars on dashboard/profile + leaderboard badges |
| UX-02 | Engagement | Teacher view of each student dictionary + stats | done |  | Added Student Dictionaries section in `/admin/dashboard` |
| UX-03 | Engagement | Teacher dictionary filters + CSV export | done |  | Search/category/date/recent filters + export current filtered view |
| AI-01 | AI | Llama definition/example generation in collector | done |  | `/api/ai/definition-example` + NVIDIA OpenAI-compatible API wiring |
| IMG-01 | Media | Word image support in vocabulary entries | done |  | `vocabulary.image_url` + card/teacher display + CSV inclusion |
| IMG-02 | Media | Direct image upload to Supabase bucket | done |  | Bucket `lexikeep` upload integrated in collector |
| IMG-03 | Media | Client-side image compression before upload | done |  | Resize/compress to webp prior to storage upload |

## In Progress This Week

| Task | Status | Next Step | Blocker |
|---|---|---|---|
| P1-01 + P1-02 dashboard hooks/quests | done | Run SQL migration in Supabase and seed records | Waiting for DB migration |
| Teacher material CRUD on `/admin/dashboard` | done | Add publish/draft control and filters | None |
| Teacher challenge + quest CRUD on `/admin/dashboard` | done | Add validation and conflict guardrails | None |
| Admin section navigation rework (single active section) | done | Add optional sticky quick actions | None |
| Auth MVP (register/login/logout/guards/role redirects) | done | Start `P1-01` daily hooks on student dashboard | None |
| Attach student data to profiles (dashboard/vocabulary/profile/leaderboard/materials) | done | Add teacher material management UI | None |
| Mobile-first spacing refinement | done | Monitor real device feedback | None |
| Student/teacher dashboard split | done | Add role-based redirect after login | Auth role wiring |
| Visual excitement refresh (colors/animation/FAB) | done | Tune motion intensity for accessibility | None |
| Teacher student dictionary viewer (stats + entries) | done | Add pagination for very large datasets | None |
| Student dictionary filters + CSV export | done | Add bulk export options by class/team | None |
| Word image uploads to Supabase (`lexikeep`) | done | Add replace/delete image action in UI | None |
| Client-side image compression before upload | done | Show original vs compressed size in UI | None |
| AI definition/example generation (Llama) | done | Add fallback template if AI unavailable | None |

## Change Log

### 2026-02-11
- Created initial tracker file.
- Added phased roadmap tasks (P1-P3).
- Marked completed UI foundation tasks from current build.
- Started auth MVP implementation (Supabase forms, context, middleware guards).
- Completed auth MVP implementation and role-based route protection.
- Attached core student pages to profile-scoped Supabase data and added baseline RLS policies.
- Implemented daily hooks + weekly quest progress UI and data helpers on student dashboard.
- Implemented teacher-side material CRUD on `/admin/dashboard`.
- Implemented teacher-side daily challenge + weekly quest CRUD on `/admin/dashboard`.
- Reorganized admin dashboard with sidebar/tabs and single active section rendering.

### 2026-02-14
- Added post-submit micro-lesson feedback and quick quiz in vocabulary collector.
- Added one-time quiz bonus award flow (+3 points) and profile points refresh.
- Added student badge MVP (6 badges) with progress/unlock state on dashboard.
- Switched badge flow to DB-backed sync (`badge_definitions` + `student_badges`) with fallback mode if SQL not yet applied.
- Added badge unlock message after save/bonus actions and persisted badge reward points.
- Added spaced-repetition review pipeline: review item generation on save, `/review` queue UI, and easy/hard scheduling with points.
- Added dashboard "Reviews Due" stat and student navigation entry for review.
- Added context scoring for example sentences with immediate feedback and quality-based bonus points.
- Completed duel mode MVP with lobby/create/join/start flow, timed rounds, finish rewards, and rematch.
- Added team leaderboard UI/data flow in competition page with fallback mode.
- Added teacher-side team CRUD and member assignment/removal on `/admin/dashboard`.
- Added teacher boosts schema and RLS in `supabase/schema.sql` for upcoming Double XP windows.
- Added teacher boost management sections on `/admin/dashboard` and connected boost windows to point awards.
- Added student "Reviewed Today" dashboard widget.
- Added teacher review adoption analytics on admin overview (due now, reviewed today, mastered, active reviewers).
- Added review streak tracking from `review_items` and sync into `profiles.streak` after review submissions.
- Added admin overview insights for top materials by usage and top teams by points.
- Added points-based student levels with tier names and progress-to-next-level UI.

### 2026-02-15
- Added AI generation route for definition + example and wired collector "Generate with Llama 3" action.
- Switched AI provider wiring to NVIDIA OpenAI-compatible endpoint via env config.
- Added teacher "Student Dictionaries" section on `/admin/dashboard` with per-student stats and entry lists.
- Added teacher-side student dictionary filters (search/category/date/recent) and CSV export of filtered results.
- Added `image_url` support for vocabulary entries across type definitions, save flow, student cards, and teacher view.
- Added student-side direct image upload to Supabase Storage bucket `lexikeep`.
- Added client-side image compression/resizing before upload (webp output).
- Replaced recent `<img>` usage with `next/image` and validated clean lint/build.

## Decision Log

| Date | Decision | Reason |
|---|---|---|
| 2026-02-11 | Separate student and teacher dashboards | Different workflows and metrics |
| 2026-02-11 | Mobile-first navigation with bottom tabs | Better student usability on phones |
| 2026-02-11 | Floating quick-add CTA on student dashboard | Faster vocabulary capture |
| 2026-02-14 | Skip in-app pronunciation feature | Practice will be delivered live in class |
| 2026-02-15 | Use Supabase Storage bucket `lexikeep` for student word images | Centralized, reliable media handling from app UI |
| 2026-02-15 | Use NVIDIA-hosted Llama endpoint for AI generation | Stable hosted inference with OpenAI-compatible API |

## Ready Next

1. Add image replace/remove controls per vocabulary item (student + teacher moderation path).
2. Add pagination/infinite-scroll in teacher Student Dictionaries for large classes.
3. Add AI fallback template when model call fails (quick non-blocking UX).
4. Tune point economics after one week of real usage data.
5. Start next `P3-04` analytics slice (per-team and per-material learning insights over time).
