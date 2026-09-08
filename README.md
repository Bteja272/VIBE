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

> Open a room, take a seat, see who is actually there, chat in real time, mention people around you, and share music without being forced to create an account.

VIBE combines persistent registered identities with temporary guest sessions. Durable room ownership and membership live in PostgreSQL, while high-frequency presence, chat, and music state live in Redis.

---

## What VIBE Is

VIBE is a realtime social-room platform built around the idea of a lightweight **virtual third place**: a space where people can study, listen to music, chat, and spend time together without the overhead of a traditional meeting application.

The project is intentionally built as a modular monolith first. REST handles durable application operations, Socket.IO handles realtime interaction, PostgreSQL stores persistent relational state, and Redis stores fast-changing room state.

> **PostgreSQL remembers who owns and belongs to a room. Redis remembers who is actually there right now.**

### What VIBE currently does

- Google sign-in for persistent registered accounts
- Temporary guest identities without mandatory account creation
- User-controlled VIBE display names
- Preset VIBE avatars for registered users and guests
- Persistent registered profile identity across Google logins
- Public and private room creation
- Persistent room ownership and registered memberships
- Realtime room watching without consuming active capacity
- Redis-backed live presence
- Refresh-safe presence deduplication
- Guest active-room restoration within the browser session
- Atomic 12-person active-room capacity enforcement
- Fixed 12-seat spatial room layout
- Stable participant seat assignments during presence changes
- Browser-session seat persistence
- Click-to-move between empty seats
- Realtime Redis-backed room chat
- Temporary speech bubbles above participant avatars
- Compact in-room chat drawer
- Unread room-message indicator
- `@` mention autocomplete and highlighting
- Personal mention notifications
- Participant interaction menus
- One-click participant mention action
- Redis-backed shared room music state
- Compact in-room music popover
- Owner / participant music-control permissions
- Realtime occupancy, chat, music, and presence updates through Socket.IO

### Planned next

- Embedded shared music playback
- Shared play / pause / seek synchronization
- Ephemeral private DMs
- Additional room visual themes and layouts
- Improved room discovery
- Observability and automated testing
- CI/CD and production deployment

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
Choose display name + preset avatar
  ↓
Browse or create rooms
  ↓
Persistent ownership / membership
  ↓
Join spatial room
  ↓
Seat + chat + mentions + music + participant interactions
```

Registered users are persisted in PostgreSQL. Google provides authentication, while VIBE owns the public display identity shown inside the product.

A registered user's VIBE display name and avatar are not overwritten by later Google logins.

### Guest users

```text
Home
  ↓
Continue as Guest
  ↓
Choose display name + preset avatar
  ↓
Temporary VIBE JWT
  ↓
Browse rooms
  ↓
Join active room
  ↓
Seat + chat + mentions + music + participant interactions
```

Guests do not require Google sign-in and do not receive persistent Prisma membership rows. Their identity and active-room state remain temporary.

### Refresh behavior

Guest identity and active-room state survive page refreshes within the same browser tab/session.

A stable `presenceId` is stored in session storage so a refresh can replace the previous socket connection instead of counting the same participant twice.

Spatial seat assignments are also stored in session storage so the local room layout remains stable across refreshes.

---

## Identity Architecture

VIBE uses one application identity shape for guests and registered users:

```ts
type IdentityType = "GUEST" | "REGISTERED";

interface AuthUser {
  id: string;
  displayName: string;
  type: IdentityType;
  email?: string;
  imageUrl?: string;
  avatarId?: string;
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
VIBE profile
(displayName + avatarId)
   ↓
Short-lived VIBE JWT
```

The Google account establishes authenticated identity. The VIBE profile controls the public identity shown to other participants.

### Guest identity

```text
Display name + avatar
   ↓
POST /auth/guest
   ↓
guest_<uuid>
   ↓
Temporary VIBE JWT
   ↓
sessionStorage
```

Guest identities are intentionally temporary and are not persisted as registered database users.

---

## 2D Spatial Room

The room itself is now the main realtime interaction surface.

```text
┌──────────────────────────────────────────────┐
│ 🔊                                      💬  │
│                                              │
│                    VIBE                      │
│                                              │
│          🐸 Kratos       🐱 Chaos            │
│             ⋯               ⋯                │
│                                              │
│       empty seat      empty seat             │
└──────────────────────────────────────────────┘
```

### Current spatial behavior

- Maximum of 12 active participants
- Fixed 12-seat coordinate system
- Central seats are assigned first
- Existing occupants keep their seats as others enter or leave
- New arrivals receive the next available seat deterministically
- The current participant can click an empty seat to move
- Occupied seats cannot be taken
- Seat assignments persist in browser session storage
- Presence remains authoritative on the backend
- Visual seat placement remains a frontend concern

The current seat selection is intentionally browser-local. It is not yet synchronized as shared authoritative state across every client.

---

## Participant Avatars

VIBE uses preset avatar IDs rather than treating third-party profile images as the social identity inside a room.

Current avatar presets include:

```text
frog
cat
ghost
blob
robot
duck
alien
bear
```

Avatar IDs are carried through VIBE identity, presence, chat, and profile state.

This means the visual representation can later move from the current renderer to custom SVG or richer avatar assets without changing the identity contract.

---

## Realtime Architecture

A room can be **watched** without being **entered**.

That distinction matters because simply opening a page should not consume room capacity.

```text
Open room
   ↓
room:watch
   ↓
Receive realtime room updates
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
| `room:watch` | Subscribe to room updates without entering active presence |
| `presence:enter` | Become an active room participant |
| `presence:leave` | Leave active room presence |
| `presence:update` | Broadcast current room occupants |
| `presence:heartbeat` | Refresh active presence ownership/liveness |
| `chat:history` | Load temporary room chat history |
| `chat:send` | Send a message as an active participant |
| `chat:message` | Broadcast a new room message |
| `music:get` | Load current room music state |
| `music:set` | Share or update a track |
| `music:clear` | Clear the current track |
| `music:permission` | Change the room music-control policy |
| `music:update` | Broadcast the current music state |

---

## Room Capacity

VIBE currently supports a maximum of **12 active participants per room**.

Capacity is based on **live Redis presence**, not PostgreSQL membership.

```text
Persistent membership
        ≠
Current occupancy
```

The admission check uses an atomic Redis operation:

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

This prevents concurrent join requests from bypassing the room limit.

---

## Presence Refresh Deduplication

Presence is keyed by a stable browser-session `presenceId`, not directly by Socket.IO `socketId`.

Redis stores room presence in a structure conceptually similar to:

```text
vibe:presence:<roomId>

presenceId -> {
  presenceId,
  socketId,
  userId,
  displayName,
  identityType,
  avatarId?,
  email?,
  lastSeenAt
}
```

On refresh:

1. the browser keeps the same `presenceId`
2. Socket.IO creates a new socket
3. Redis replaces the stored socket ID
4. the old socket eventually disconnects
5. the server checks socket ownership before removing presence
6. the replacement connection remains active

The application also uses presence heartbeats and stale-entry cleanup so abandoned socket state does not remain indefinitely.

---

## Chat

Room chat is realtime and intentionally temporary.

### Current behavior

- Only active room participants can send
- Room watchers can load temporary history
- Messages are stored in Redis
- Maximum retained history: 50 messages
- Chat TTL: 24 hours
- Guests and registered users can participate
- Messages include display identity and avatar metadata
- New messages can appear temporarily above the sender's spatial avatar
- Unread messages show an indicator on the room chat control
- The chat drawer is embedded directly into the spatial room

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

### Mentions

Typing `@` opens autocomplete for active room participants.

```text
@Cha...
   ↓
Chaos
   ↓
@Chaos 
```

Current mention behavior includes:

- active-participant autocomplete
- keyboard navigation
- mention highlighting inside chat messages
- stronger highlighting when the current user is mentioned
- unread mention counter
- temporary in-room mention notification
- clicking a participant's menu can open chat with `@DisplayName` prefilled

Mention resolution is currently display-name based. Structured mention metadata can be added later if the product needs stronger identity guarantees.

---

## Participant Interaction Menu

Each participant has a compact `⋯` interaction menu.

For another participant:

```text
┌──────────────────────┐
│ 🐱 Chaos             │
│ Guest                │
├──────────────────────┤
│ @  Mention      Room │
│ 💬 Message      Soon │
└──────────────────────┘
```

The current menu supports:

- participant identity summary
- guest / registered status
- one-click room mention
- a reserved private-message entry point

Private messaging is intentionally not implemented yet. The disabled Message action preserves a natural UI location for the later ephemeral-DM system.

The current user's own menu provides identity context and reminds them that empty seats can be selected directly.

---

## Shared Music

VIBE currently supports shared room music **metadata and links**, not audio rebroadcasting.

```ts
interface RoomMusicState {
  roomId: string;

  permission:
    | "OWNER_ONLY"
    | "ANY_MEMBER";

  track: {
    url: string;
    title?: string;
    provider?: string;
    sharedBy: string;
  } | null;

  updatedAt: string;
}
```

The state is stored in Redis and broadcast through Socket.IO.

### Current music UI

The previous standalone music card has been replaced by an in-room speaker control.

```text
🔊
 ↓
Shared music popover
 ↓
Current track
Shared by
Open track
Share / Clear
Permission control
```

Only one major room interaction surface is intended to be open at once: opening music closes chat, and opening chat closes music.

### Planned playback stage

- YouTube embed playback
- shared play / pause
- seek synchronization
- playback timestamps
- later Spotify embed support where supported

VIBE will not rebroadcast or host copyrighted audio.

---

## Durable vs Ephemeral State

| State | Storage | Reason |
|---|---|---|
| Registered users | PostgreSQL | Durable account identity |
| VIBE display names | PostgreSQL | Persistent public profile |
| Registered avatar selection | PostgreSQL | Persistent public profile |
| Rooms | PostgreSQL | Durable room metadata |
| Ownership | PostgreSQL | Durable authorization |
| Registered memberships | PostgreSQL | Persistent membership |
| Guest identity | Browser session + JWT | Temporary identity |
| Guest avatar selection | Browser session + JWT | Temporary profile state |
| Active room presence | Redis | High-frequency ephemeral state |
| Chat history | Redis | Temporary realtime history |
| Music state | Redis | Shared volatile room state |
| Local seat preference | Browser session | Prototype visual placement |
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
Room ownership, registered users, profiles, and memberships are durable relational data. Presence, chat, and current music state change frequently and do not need the same durability model.

**Why Socket.IO instead of raw WebSockets?**  
VIBE needs rooms, reconnection handling, acknowledgements, and Redis-backed fan-out. Socket.IO provides those primitives without rebuilding them manually.

**Why REST and Socket.IO instead of GraphQL?**  
The persistent API surface is predictable and relatively small. REST handles CRUD while Socket.IO handles realtime state, keeping responsibilities clear.

**Why a modular monolith first?**  
The current system does not need independent microservice deployment or Kafka. A modular NestJS backend keeps the architecture simpler while preserving service boundaries.

**Why Redis for capacity?**  
The product limit applies to people actively occupying a room, not people who have historically joined it.

**Why an atomic capacity check?**  
A separate count-then-insert sequence could admit too many participants during simultaneous joins.

**Why are guests not Prisma users?**  
Guest identities are intentionally temporary. Creating permanent rows for anonymous visitors would blur the distinction between durable accounts and ephemeral participation.

**Why does opening a room not count as joining?**  
A viewer should be able to inspect a room without taking one of the active participant slots.

**Why keep Google identity separate from VIBE identity?**  
Authentication identity and public product identity serve different purposes. Users should control the display name and avatar other participants see.

**Why is seat placement frontend-owned right now?**  
Presence is shared application state and must be authoritative. Seat placement is currently a presentation concern, so keeping it frontend-local avoids adding synchronization complexity before the product requires shared authoritative seats.

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

If the generated database package changed:

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

### Identity endpoints

```text
POST  /auth/guest
POST  /auth/registered   # internal Next.js server exchange
GET   /auth/me
PATCH /auth/profile
PATCH /auth/avatar
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

Registered users can create rooms, persist membership, and own rooms.

Guests participate through authenticated realtime presence without persistent room membership.

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
│   │   │   ├── spatial-room.tsx
│   │   │   ├── vibe-avatar.tsx
│   │   │   └── vibe-profile-setup.tsx
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   ├── api.ts
│   │   │   │   ├── guest-auth.ts
│   │   │   │   ├── presence-session.ts
│   │   │   │   ├── socket.ts
│   │   │   │   └── spatial-layout.ts
│   │   │   └── types/
│   │   │       └── chat.ts
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

### Core platform

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
- [x] Authenticated REST writes
- [x] Authenticated Socket.IO identities
- [x] Socket.IO Redis adapter

### Identity and avatars

- [x] User-chosen registered display names
- [x] Guest display-name sessions
- [x] Registered profile onboarding
- [x] Preset avatar system
- [x] Registered avatar persistence
- [x] Guest avatar session state
- [x] Avatar rendering in room presence
- [x] Avatar rendering in chat
- [x] Avatar rendering in membership UI
- [x] Avatar rendering in participant interactions

### Presence and capacity

- [x] Redis-backed live presence
- [x] Watch-room vs enter-room semantics
- [x] Refresh-safe presence deduplication
- [x] Guest active-room restoration after refresh
- [x] Presence heartbeat
- [x] Stale-presence cleanup
- [x] Atomic 12-person active-room capacity

### 2D spatial room

- [x] Spatial room canvas
- [x] Fixed 12-seat layout
- [x] Participant avatars
- [x] Deterministic seat assignment
- [x] Stable seats while occupancy changes
- [x] Browser-session seat persistence
- [x] User-selectable empty seats
- [x] Occupied-seat protection
- [x] Current-user visual distinction
- [x] Participant online indicators

### Chat and room interaction

- [x] Redis-backed realtime room chat
- [x] Temporary 24-hour chat history
- [x] Latest-50-message retention
- [x] Compact in-room chat drawer
- [x] Avatar speech bubbles
- [x] Unread chat indicator
- [x] `@` mention autocomplete
- [x] Mention highlighting
- [x] Mention counter
- [x] In-room mention notifications
- [x] Participant `⋯` interaction menu
- [x] One-click participant mention action
- [x] Reserved private-message UI entry point

### Shared music

- [x] Redis-backed shared music state
- [x] Owner/participant music permissions
- [x] Compact in-room music popover
- [x] Realtime music-state updates
- [x] Track URL/title sharing
- [x] Clear current track

### Planned product work

- [ ] Embedded shared YouTube playback
- [ ] Shared play/pause synchronization
- [ ] Seek synchronization
- [ ] Ephemeral private DMs
- [ ] Redis-backed DM inactivity TTL
- [ ] Guest-compatible temporary conversations
- [ ] Additional spatial layouts/themes
- [ ] Improved room discovery
- [ ] Live occupancy on homepage cards
- [ ] Private-room access refinement

### Engineering work

- [ ] Backend unit/integration tests
- [ ] Frontend component tests
- [ ] Playwright or Cypress E2E coverage
- [ ] Capacity race-condition tests
- [ ] Presence refresh/reconnect tests
- [ ] Guest/registered auth tests
- [ ] Structured logging
- [ ] Prometheus metrics
- [ ] Grafana dashboards
- [ ] GitHub Actions CI
- [ ] Production Docker deployment

---

## Security Notes

### Implemented

- Google OAuth through Auth.js
- Backend JWT validation
- Separate guest and registered identity types
- Internal server-to-server secret for registered-token exchange
- Protected room write endpoints
- Server-derived Socket.IO user identity
- Browser clients cannot authorize themselves by claiming arbitrary account data
- Owner checks use persistent database identity
- Guest identities remain temporary
- Room capacity is enforced server-side
- Presence ownership is tied to socket state
- CORS is restricted to the frontend development origin

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

## Design Principles

VIBE intentionally separates concepts that are easy to conflate:

```text
Account identity
      ≠
Public display identity
      ≠
Persistent room membership
      ≠
Live room presence
      ≠
Visual seat placement
```

A Google account proves who a registered user is.

A VIBE profile determines how that person appears to other participants.

PostgreSQL membership records who durably belongs to a room.

Redis presence determines whether that person is occupying the room right now.

The frontend currently determines where that active participant appears inside the 2D room.

That separation keeps durable data, realtime state, and visual presentation from becoming unnecessarily coupled.

---

## License

MIT

---

> Built as a realtime social-room platform combining persistent PostgreSQL ownership, temporary guest and registered JWT identities, Redis-backed presence/chat/music state, atomic capacity enforcement, Socket.IO synchronization, preset avatars, stable spatial seating, realtime mentions, participant interactions, and an integrated 2D room experience in a Next.js + NestJS monorepo.
