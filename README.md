# 🌐 VIBE

### Virtual Immersive Browsing Environment

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-TypeScript-61DAFB?style=flat&logo=react&logoColor=black)
![NestJS](https://img.shields.io/badge/NestJS-Backend-E0234E?style=flat&logo=nestjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Persistent_State-336791?style=flat&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-Realtime_State-DC382D?style=flat&logo=redis&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-Realtime-010101?style=flat&logo=socketdotio&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat&logo=prisma&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat&logo=docker&logoColor=white)
![Status](https://img.shields.io/badge/Status-Active_Development-yellow?style=flat)

> Open a room, see who is actually there, chat in real time, share music, and hang out without being forced to create an account. VIBE combines persistent registered identities with temporary guest sessions and keeps high-frequency room state in Redis while durable ownership and membership live in PostgreSQL.

---

## What VIBE Is

VIBE is a realtime social-room platform built around the idea of a lightweight **virtual third place**: a space where people can study, listen to music, chat, and spend time together without the overhead of a traditional meeting app.

The project is designed as a modular monolith first, with clear boundaries between durable application state and ephemeral realtime state.

> **PostgreSQL remembers who owns and belongs to a room. Redis remembers who is actually there right now.**

### What VIBE currently does

- Sign in with Google for a persistent account
- Continue without an account using a temporary guest identity
- Let registered users choose a VIBE display name
- Preserve registered display names across future Google logins
- Let guests choose a display name once per browser session
- Create public or private rooms
- Persist room ownership and registered memberships
- Join and leave rooms
- Track live room presence through Socket.IO + Redis
- Preserve guest room presence across refreshes
- Prevent refreshes from creating duplicate presence entries
- Enforce a maximum active room capacity of 12
- Perform the capacity check atomically in Redis
- Support realtime room chat
- Persist the latest 50 chat messages temporarily in Redis
- Share room music links and metadata
- Apply owner / participant music permissions
- Update occupancy and presence in realtime

### What VIBE is becoming

- A 2D spatial room with adaptive seating/layouts
- Preset avatar identities
- Compact floating chat
- Embedded shared music playback
- Ephemeral private DMs
- Improved room discovery
- Observability, tests, CI/CD, and deployment

---

## Current User Experience

### Registered users

```text
Home
  ↓
Continue with Google
  ↓
First-time VIBE profile setup
  ↓
Choose display name
  ↓
Browse or create rooms
  ↓
Persistent ownership / membership
  ↓
Realtime presence, chat, music
```

Registered users are persisted in PostgreSQL. Google provides authentication, while VIBE owns the public display identity shown inside the product.

### Guest users

```text
Home
  ↓
Continue as Guest
  ↓
Choose display name
  ↓
Temporary VIBE JWT
  ↓
Browse rooms
  ↓
Join active room
  ↓
Realtime presence, chat, music
```

Guests do not require Google sign-in and do not receive persistent Prisma membership rows. Their identity and active-room state are stored temporarily in browser session storage and Redis.

### Refresh behavior

Guest identity and active-room state survive page refreshes within the same browser tab/session.

A stable `presenceId` is also stored in session storage, allowing Redis to replace the old socket connection after refresh instead of counting the same person twice.

---

## Identity Architecture

VIBE uses one backend identity model for both registered users and guests:

```ts
type IdentityType = "GUEST" | "REGISTERED";

interface AuthUser {
  id: string;
  displayName: string;
  type: IdentityType;
  email?: string;
  imageUrl?: string;
}
```

### Registered identity

```text
Google OAuth
   ↓
Auth.js session
   ↓
Next.js server-only token exchange
   ↓
POST /auth/registered
   ↓
PostgreSQL User upsert
   ↓
Short-lived VIBE JWT
```

The Google email is used as account identity, but the user-facing VIBE display name is stored separately.

### Guest identity

```text
Display name
   ↓
POST /auth/guest
   ↓
guest_<uuid>
   ↓
12-hour VIBE JWT
   ↓
sessionStorage
```

Guest identities are intentionally temporary.

---

## Realtime Architecture

A room can be **watched** without being **joined**.

That distinction matters because simply opening a page should not consume room capacity.

```text
Open room
   ↓
room:watch
   ↓
Receive presence/chat/music updates
   ↓
NOT counted as active occupancy
```

To become an active participant:

```text
Authenticated socket
   ↓
presence:enter
   ↓
Atomic Redis capacity check
   ↓
Presence entry created
   ↓
presence:update broadcast
```

### Main Socket.IO events

| Event | Purpose |
|---|---|
| `room:watch` | Subscribe to room updates without entering presence |
| `presence:enter` | Become an active room participant |
| `presence:leave` | Leave active room presence |
| `presence:update` | Broadcast current room occupants |
| `chat:history` | Load temporary room chat history |
| `chat:send` | Send a message as an active participant |
| `chat:message` | Broadcast a new room message |
| `music:get` | Load current room music state |
| `music:set` | Share/update a track |
| `music:clear` | Clear current track |
| `music:permission` | Change room music control policy |
| `music:update` | Broadcast current music state |

---

## Room Capacity

VIBE currently supports a maximum of **12 active participants per room**.

Capacity is based on **live Redis presence**, not PostgreSQL membership.

```text
Persistent membership
        ≠
Current occupancy
```

The admission check uses an atomic Redis Lua operation:

```text
presence:enter
   ↓
Does presenceId already exist?
   ├── Yes → refresh/update socket safely
   └── No
         ↓
      HLEN < 12?
         ├── Yes → add participant
         └── No  → reject "Room is full"
```

This prevents two simultaneous join attempts from both becoming participant #12.

---

## Presence Refresh Deduplication

Presence is keyed by a stable browser-session `presenceId`, not directly by Socket.IO `socketId`.

Redis stores:

```text
vibe:presence:<roomId>

presenceId -> {
  presenceId,
  socketId,
  userId,
  displayName,
  identityType,
  email?
}
```

On refresh:

1. the browser keeps the same `presenceId`
2. Socket.IO creates a new socket
3. Redis replaces the stored socket ID
4. the old socket eventually disconnects
5. the server checks the stored socket ID before deleting presence
6. the replacement connection remains active

This prevents stale disconnects from deleting the user's new presence.

---

## Chat

Room chat is realtime and intentionally temporary.

Current behavior:

- Only active room participants can send
- Room watchers can receive history
- Messages are stored in Redis
- Maximum retained history: 50 messages
- Chat TTL: 24 hours
- Messages include user identity metadata
- Guests and registered users can both participate

```text
chat:send
   ↓
Validate active presence
   ↓
Validate message
   ↓
Redis RPUSH
   ↓
Trim to latest 50
   ↓
Refresh TTL
   ↓
Broadcast chat:message
```

A compact floating chat UI and ephemeral private DMs are planned later.

---

## Music State

VIBE currently supports shared room music **metadata and links**.

Current room state includes:

```ts
interface RoomMusicState {
  roomId: string;
  permission: "OWNER_ONLY" | "ANY_MEMBER";
  track: {
    url: string;
    title?: string;
    provider?: string;
    sharedBy: string;
  } | null;
  updatedAt: string;
}
```

The music state is stored in Redis and broadcast through Socket.IO.

Planned next-stage behavior:

- YouTube embed playback
- shared play / pause
- seek synchronization
- playback timestamps
- later Spotify embed support

VIBE will not rebroadcast or host copyrighted audio.

---

## Durable vs Ephemeral State

| State | Storage | Reason |
|---|---|---|
| Registered users | PostgreSQL | Durable account identity |
| VIBE display names | PostgreSQL | Persistent user profile |
| Rooms | PostgreSQL | Durable room metadata |
| Ownership | PostgreSQL | Durable authorization |
| Registered memberships | PostgreSQL | Persistent membership |
| Guest identity | Browser session + JWT | Temporary identity |
| Active room presence | Redis | High-frequency ephemeral state |
| Chat history | Redis | Temporary realtime history |
| Music state | Redis | Shared volatile room state |
| Socket fan-out | Socket.IO + Redis adapter | Realtime synchronization |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React, TypeScript |
| Styling | Tailwind CSS |
| Authentication | Auth.js / Google OAuth + VIBE JWT |
| Backend | NestJS 11 |
| HTTP adapter | Express |
| REST API | NestJS controllers |
| Realtime | Socket.IO |
| Realtime scaling | Socket.IO Redis adapter |
| Persistent database | PostgreSQL |
| ORM | Prisma 7 |
| Ephemeral state | Redis 8 |
| Local infrastructure | Docker Compose |
| Monorepo | pnpm workspaces |
| Development | WSL2, Linux, Docker |

---

## 🏗️ Key Technical Decisions

**Why PostgreSQL and Redis together?**  
Room ownership, registered users, and memberships are durable relational data. Presence, chat, and current music state change frequently and do not need the same durability guarantees.

**Why Socket.IO instead of raw WebSockets?**  
VIBE needs rooms, reconnection handling, acknowledgements, and Redis-backed fan-out. Socket.IO provides those primitives without rebuilding them manually.

**Why REST and Socket.IO instead of GraphQL?**  
The persistent API surface is predictable and relatively small. REST handles CRUD while Socket.IO handles realtime state, keeping the boundaries clear.

**Why a modular monolith first?**  
The system does not yet need Kafka or independent microservice deployment. A modular NestJS backend keeps the architecture simpler while preserving clear service boundaries.

**Why Redis for capacity?**  
The product limit applies to people actively occupying a room, not people who have historically joined it.

**Why an atomic Lua capacity check?**  
A separate count-then-insert sequence could admit more than 12 users under simultaneous joins.

**Why are guests not Prisma users?**  
Guest identities are intentionally temporary. Creating permanent database rows for every anonymous visitor would blur the distinction between persistent accounts and ephemeral participation.

**Why does merely opening a room not count as joining?**  
A room viewer should be able to inspect the room without taking one of the 12 active participant slots.

**Why keep Google identity separate from VIBE display name?**  
Authentication identity and public product identity serve different purposes. Users should control what other participants see.

---

## 🚀 Quick Start

### 1. Clone

```bash
git clone https://github.com/Bteja272/VIBE.git
cd VIBE
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Environment

Create the required local environment files from safe placeholders.

Do not commit secrets.

Typical backend/root values include:

```env
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379
BACKEND_JWT_SECRET=...
VIBE_INTERNAL_SECRET=...
```

Typical frontend values include:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
BACKEND_API_URL=http://localhost:4000
VIBE_INTERNAL_SECRET=...
AUTH_SECRET=...
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
```

`VIBE_INTERNAL_SECRET` must remain server-only and must **not** use a `NEXT_PUBLIC_` prefix.

### 4. Start PostgreSQL and Redis

```bash
docker compose up -d
docker compose ps
```

Current local defaults:

```text
PostgreSQL host port: 5435
Redis host port:      6379
```

### 5. Prisma migration and generation

```bash
cd packages/database

pnpm exec prisma migrate dev
pnpm exec prisma generate
```

If the generated database package changed, rebuild it before starting the server:

```bash
cd ~/Projects/VIBE
pnpm --filter @vibe/database build
```

### 6. Backend

From the repository root:

```bash
pnpm dev:server
```

Backend:

```text
http://localhost:4000
```

### 7. Frontend

In a second terminal:

```bash
pnpm dev:web
```

Frontend:

```text
http://localhost:3000
```

---

## 🔌 API Overview

### Public / identity endpoints

```text
POST /auth/guest
POST /auth/registered   # internal Next.js server exchange
GET  /auth/me
PATCH /auth/profile
```

### Room endpoints

```text
GET    /rooms
GET    /rooms/slug/:slug
GET    /rooms/:id
POST   /rooms
POST   /rooms/:id/join
DELETE /rooms/:id/leave
PATCH  /rooms/:id
DELETE /rooms/:id
```

Room writes use:

```http
Authorization: Bearer <VIBE_JWT>
```

Registered users can create, persist membership, and own rooms.

Guests currently participate through authenticated realtime presence without persistent room membership.

---

## 📁 Project Structure

```text
VIBE/
├── apps/
│   ├── web/
│   │   ├── app/
│   │   │   ├── api/auth/
│   │   │   ├── onboarding/
│   │   │   ├── rooms/
│   │   │   └── page.tsx
│   │   ├── components/
│   │   │   ├── auth-controls.tsx
│   │   │   ├── create-room-form.tsx
│   │   │   ├── guest-entry.tsx
│   │   │   ├── owner-room-actions.tsx
│   │   │   ├── room-actions.tsx
│   │   │   ├── room-chat.tsx
│   │   │   ├── room-music.tsx
│   │   │   ├── room-occupancy.tsx
│   │   │   ├── room-presence.tsx
│   │   │   └── vibe-profile-setup.tsx
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   ├── api.ts
│   │   │   │   ├── guest-auth.ts
│   │   │   │   ├── presence-session.ts
│   │   │   │   └── socket.ts
│   │   │   └── types/
│   │   └── auth.ts
│   │
│   └── server/
│       └── src/
│           ├── auth/
│           ├── database/
│           ├── realtime/
│           │   ├── chat.service.ts
│           │   ├── music.service.ts
│           │   ├── presence.service.ts
│           │   ├── realtime.gateway.ts
│           │   └── redis-io.adapter.ts
│           ├── rooms/
│           └── users/
│
├── packages/
│   └── database/
│       ├── prisma/
│       │   ├── migrations/
│       │   └── schema.prisma
│       └── generated/
│
├── docker-compose.yml
├── pnpm-workspace.yaml
└── README.md
```

---

## ✅ Status

### Complete

- [x] pnpm monorepo
- [x] Next.js + React + TypeScript frontend
- [x] NestJS backend
- [x] PostgreSQL + Prisma
- [x] Redis infrastructure
- [x] Docker Compose local environment
- [x] Room CRUD
- [x] Public/private room metadata
- [x] Persistent room ownership
- [x] Persistent registered memberships
- [x] Google authentication through Auth.js
- [x] Backend-issued registered-user JWTs
- [x] Backend-issued guest JWTs
- [x] User-chosen registered display names
- [x] Guest display-name sessions
- [x] Registered profile onboarding
- [x] Authenticated REST writes
- [x] Authenticated Socket.IO identities
- [x] Redis-backed live presence
- [x] Watch-room vs enter-room semantics
- [x] Refresh-safe presence deduplication
- [x] Guest active-room restoration after refresh
- [x] Atomic 12-person active-room capacity
- [x] Redis-backed room chat
- [x] Temporary 24-hour chat history
- [x] Redis-backed shared music state
- [x] Owner/participant music permissions
- [x] Socket.IO Redis adapter

### Current milestone

- [ ] Preset avatar system
- [ ] Registered avatar persistence
- [ ] Guest avatar session state
- [ ] Avatar rendering in presence/chat/member UI
- [ ] Identity/profile UI polish

### 2D room milestone

- [ ] Spatial room canvas
- [ ] Participant avatars
- [ ] Seat assignment
- [ ] Adaptive layouts by occupancy
- [ ] Owner-selectable valid layouts
- [ ] 1–2 participant layout
- [ ] 3–4 participant layout
- [ ] 5–6 participant layout
- [ ] 7–8 participant layout
- [ ] 9 participant 3×3 layout
- [ ] 10–12 participant 3×4 layout

### Product polish milestone

- [ ] Compact floating chat
- [ ] Unread chat indicator
- [ ] Optional mentions
- [ ] Shared YouTube playback
- [ ] Play/pause synchronization
- [ ] Seek synchronization
- [ ] Improved room discovery
- [ ] Live occupancy on homepage cards
- [ ] Private-room access refinement

### Later realtime features

- [ ] Ephemeral private DMs
- [ ] Redis-backed DM TTL
- [ ] Guest-compatible temporary conversations
- [ ] Reconnection-aware DM lifecycle

### Engineering milestone

- [ ] Backend unit/integration tests
- [ ] Frontend component tests
- [ ] Playwright or Cypress E2E coverage
- [ ] Capacity race-condition tests
- [ ] Presence refresh tests
- [ ] Guest/registered auth tests
- [ ] Structured logging
- [ ] Prometheus metrics
- [ ] Grafana dashboards
- [ ] GitHub Actions CI
- [ ] Production Docker deployment

---

## Planned 2D Layout Model

VIBE will eventually map active occupants into an adaptive spatial layout instead of always rendering the same grid.

Target examples:

```text
1–2   → pair / row
3–4   → 2×2 / circle
5     → row / circle
6     → 2×3 / 3×2 / circle
7–8   → 2×4 / staggered
9     → 3×3
10–12 → 3×4 classroom
```

The backend remains authoritative for who is present. The frontend determines how those active participants are visually arranged.

---

## Security Notes

### Implemented

- Google OAuth through Auth.js
- Backend JWT validation
- Separate guest and registered identity types
- Internal server-to-server secret for registered-token exchange
- Protected room write endpoints
- Server-derived Socket.IO user identity
- Browser cannot authorize itself by claiming an arbitrary email
- Owner checks use persistent database user IDs
- Guest identities remain temporary
- Room capacity enforced server-side
- CORS restricted to the frontend development origin

### Still required before production

- Production HTTPS
- Production origin configuration
- Secret management
- Stronger token lifecycle / refresh strategy
- CSRF review where applicable
- Rate limiting
- Audit/security logging
- Production Redis/PostgreSQL configuration
- Backup and restore validation
- Abuse controls
- Deployment monitoring
- Security review

---

## Design Principle

VIBE intentionally separates three concepts that are easy to conflate:

```text
Account identity
      ≠
Public display identity
      ≠
Live room presence
```

A Google account proves who a registered user is.

A VIBE profile determines how that person appears to others.

Redis presence determines whether that person is actually occupying the room right now.

That separation is central to the architecture.

---

## 📝 License

MIT

---

> Built as a realtime social-room platform combining persistent PostgreSQL ownership, ephemeral Redis presence, atomic room-capacity enforcement, guest and registered JWT identities, Socket.IO synchronization, temporary chat, shared music state, and a Next.js + NestJS monorepo — with a 2D spatial room experience as the next major product milestone.
