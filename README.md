# 🌐 VIBE

### Virtual Immersive Browsing Environment

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-TypeScript-61DAFB?style=flat&logo=react&logoColor=black)
![NestJS](https://img.shields.io/badge/NestJS-Backend-E0234E?style=flat&logo=nestjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Persistent_State-336791?style=flat&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-Realtime_State-DC382D?style=flat&logo=redis&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-Realtime-010101?style=flat&logo=socketdotio&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat&logo=prisma&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-3D_Room-000000?style=flat&logo=threedotjs&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat&logo=docker&logoColor=white)
![Status](https://img.shields.io/badge/Status-Active_Development-yellow?style=flat)

> Open a room, take a seat, see who is actually there, chat in real time, mention or message people around you, and listen to synchronized shared music without being forced to create an account.

VIBE combines persistent registered identities with temporary guest sessions. Durable room ownership and membership live in PostgreSQL, while high-frequency presence, seat, chat, DM, and music state live in Redis.

---

## What VIBE Is

VIBE is a realtime social-room platform built around the idea of a lightweight **virtual third place**: a space where people can study, listen to music, chat, and spend time together without the overhead of a traditional meeting application.

The project is intentionally built as a modular monolith first. REST handles durable application operations, Socket.IO handles realtime interaction, PostgreSQL stores persistent relational state, Redis stores fast-changing room state, and React Three Fiber renders the optional 3D room experience.

> **PostgreSQL remembers who owns and belongs to a room. Redis remembers who is actually there, where they are sitting, what they are saying, and what the room is listening to right now.**

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
- Shared server-authoritative 12-seat room state
- Click-to-move between empty seats
- Synchronized seat changes across browsers
- 2D and 3D room modes using the same logical seat IDs
- Low-poly 3D participant avatars
- Realtime Redis-backed room chat
- Temporary speech bubbles above participant avatars in both 2D and 3D
- Compact in-room chat drawer
- Unread room-message indicator
- `@` mention autocomplete and highlighting
- Personal mention notifications
- Participant interaction menus
- One-click participant mention action
- Ephemeral private DMs between active room participants
- Per-conversation unread DM tracking
- Redis-backed shared YouTube music state
- Embedded YouTube playback
- Shared play / pause / seek synchronization
- Reconnect and drift correction for playback
- Personal mute without changing shared playback state
- Owner / participant music-control permissions
- Realtime occupancy, seat, chat, DM, music, and presence updates through Socket.IO

### Planned next

- Final 3D polish and WebGL fallback handling
- Mobile/responsive 3D tuning
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
Join room
  ↓
2D or 3D shared space
  ↓
Seat + chat + mentions + DMs + synchronized music
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
2D or 3D shared space
  ↓
Seat + chat + mentions + DMs + synchronized music
```

Guests do not require Google sign-in and do not receive persistent Prisma membership rows. Their identity and active-room state remain temporary.

### Refresh behavior

Guest identity and active-room state survive page refreshes within the same browser tab/session.

A stable `presenceId` is stored in session storage so a refresh can replace the previous socket connection instead of counting the same participant twice.

Seat assignment itself is no longer browser-local. The authoritative `seatId` is stored with the participant's Redis presence record and is redistributed through `presence:update`, so all clients render the same room layout.

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

## Spatial Room

The room is the main realtime interaction surface and can be rendered in either 2D or 3D.

### Shared logical seat model

VIBE defines 12 logical seat IDs:

```text
seat-1 ... seat-12
```

The 2D and 3D renderers use different coordinates, but they consume the same logical seat assignment.

```text
Redis PresenceUser.seatId
          ↓
    presence:update
          ↓
      SpatialRoom
       ↙      ↘
  2D layout   3D layout
```

This keeps room state synchronized even if one user is viewing 2D and another is viewing 3D.

### Current spatial behavior

- Maximum of 12 active participants
- Fixed 12-seat logical room model
- Initial seat allocation is server-authoritative
- Existing users keep their seat across socket replacement when possible
- Participants can click empty seats to move
- Occupied seats cannot be claimed by another participant
- Seat movement is validated atomically in Redis
- Seat changes broadcast through normal `presence:update`
- All connected browsers see the same participant-seat mapping
- 2D and 3D share the same logical seat IDs
- Presence and seat ownership remain ephemeral and are released when presence expires

### 2D room

The 2D room remains the lightweight fallback/reference renderer.

It supports:

- participant avatars
- empty-seat interaction
- speech bubbles
- participant menus
- mention and DM actions
- music/chat overlays
- unread indicators

### 3D room

The 3D room is built with Three.js through React Three Fiber and Drei.

Current 3D behavior includes:

- fixed room environment
- 12 physical chairs
- low-poly participant avatars
- avatar-specific color styling
- subtle idle animation
- current-user labels
- online indicators
- selected-participant ring
- unread-DM indicator
- click-to-select participant interaction
- shared seat movement
- participant action card
- 3D speech bubbles
- click bubble to open room chat
- 2D / 3D mode toggle

The 3D layer intentionally reuses existing room state instead of creating a separate backend model.

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

Avatar IDs are carried through VIBE identity, presence, chat, DM, and profile state.

The 2D renderer uses the VIBE avatar component, while the 3D renderer maps the same avatar ID to a low-poly color/style configuration.

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
Server assigns / restores seatId
   ↓
presence:update broadcast
```

### Main Socket.IO events

| Event | Purpose |
|---|---|
| `room:watch` | Subscribe to room updates without entering active presence |
| `presence:enter` | Become an active room participant |
| `presence:leave` | Leave active room presence |
| `presence:update` | Broadcast current occupants and their shared seat state |
| `presence:heartbeat` | Refresh active presence ownership/liveness |
| `presence:seat` | Atomically move the current participant to an empty seat |
| `chat:history` | Load temporary room chat history |
| `chat:send` | Send a message as an active participant |
| `chat:message` | Broadcast a new room message |
| `dm:send` | Send an ephemeral direct message to another active participant |
| `dm:message` | Deliver a direct message only to sender and recipient |
| `music:get` | Load current room music state |
| `music:set` | Set / replace the shared YouTube track |
| `music:clear` | Clear the current shared track |
| `music:permission` | Change room music-control policy |
| `music:playback` | Apply shared play / pause / seek updates |
| `music:update` | Broadcast authoritative shared music state |

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
Deduplicate logical user
   ↓
Does active presence already exist?
   ├── Yes → replace socket ownership safely
   └── No
        ↓
       HLEN < 12?
        ├── Yes → add participant
        └── No  → reject "Room is full"
```

This prevents concurrent join requests from bypassing the room limit.

---

## Presence and Shared Seat State

Presence is keyed by a stable browser-session `presenceId`, while logical-user deduplication also prevents duplicate active identities during reconnects.

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
  seatId?,
  lastSeenAt
}
```

On refresh or socket replacement:

1. the browser keeps the same `presenceId`
2. Socket.IO creates a new socket
3. the server deduplicates the same logical user
4. the existing seat is preserved when valid
5. Redis replaces socket ownership
6. the old socket eventually disconnects
7. the server verifies socket ownership before removal
8. the replacement connection remains active

The application also uses presence heartbeats and stale-entry cleanup so abandoned socket state does not remain indefinitely.

### Atomic seat movement

Seat movement uses a Redis Lua operation.

```text
presence:seat
   ↓
Validate caller owns active presence
   ↓
Validate seat ID
   ↓
Check every other presence record
   ↓
Seat free?
 ├── No  → reject
 └── Yes → write participant.seatId
                ↓
        broadcast presence:update
```

Two concurrent clients therefore cannot successfully claim the same seat.

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
- New messages temporarily appear above the sender in 2D and 3D
- Speech bubbles use the same ambient `chat:message` listener
- Bubbles expire after roughly five seconds
- Clicking a speech bubble opens room chat
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
- one-click participant mention action
- participant action can open chat with `@DisplayName` prefilled

Mention resolution is currently display-name based. Structured mention metadata can be added later if the product needs stronger identity guarantees.

---

## Ephemeral Direct Messages

Private DMs are implemented as ephemeral realtime messages between active room participants.

### Current behavior

- sender must be an active participant
- recipient must still be actively present
- sender cannot DM themselves
- content is validated server-side
- DMs are delivered only to the sender and recipient sockets
- DMs are not broadcast to the room
- frontend keeps temporary per-conversation history in memory
- latest 50 messages are retained per local conversation
- unread counts are tracked per participant
- opening a conversation clears its unread count
- leaving/reloading removes local DM history
- no PostgreSQL DM persistence is created

```text
dm:send
   ↓
Validate sender presence
   ↓
Resolve recipient from Redis presence
   ↓
Resolve recipient socket
   ↓
Emit dm:message only to:
  - sender
  - recipient
```

This keeps private conversation state intentionally temporary.

---

## Participant Interaction

Participant interaction is available in both 2D and 3D.

For another participant:

```text
┌──────────────────────┐
│ 🐱 Chaos             │
│ Guest                │
├──────────────────────┤
│ @ Mention            │
│ 💬 Message           │
└──────────────────────┘
```

Current interactions include:

- participant identity summary
- guest / registered status
- one-click room mention
- one-click ephemeral DM
- unread DM indicator
- current-user self state
- shared behavior across 2D and 3D

In 3D, clicking an avatar selects the participant and opens the existing HTML interaction UI rather than embedding complex application controls inside WebGL.

---

## Shared Music

VIBE supports synchronized shared YouTube playback.

### Shared state

The room maintains authoritative shared music state in Redis, including:

- current track
- playback status
- playback position
- revision/version ordering
- update timestamp
- room-control permission

The browser embeds YouTube for playback; VIBE does not rebroadcast or host copyrighted audio.

### Current behavior

- validate and embed YouTube links
- set / clear shared track
- shared play
- shared pause
- shared seek
- reconnect synchronization
- drift correction
- authoritative revision ordering on the client
- personal mute
- owner-only or any-member control modes
- persistent music component mount while the popover is hidden
- realtime `music:update` broadcasts

```text
User changes playback
       ↓
music:playback
       ↓
Server validates presence + permission
       ↓
Redis playback mutation
       ↓
music:update
       ↓
All clients reconcile shared player state
```

### Reliability behavior

Playback mutations use authoritative server state so reconnecting participants can recover the current room position.

The frontend also applies drift correction instead of continuously forcing player position, avoiding unnecessary seeks during normal playback.

Personal mute affects only the local player and does not alter shared playback for the rest of the room.

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
| Shared seat assignment | Redis presence | Shared ephemeral spatial state |
| Chat history | Redis | Temporary realtime history |
| DM history | Client memory only | Intentionally ephemeral private state |
| Music state | Redis | Shared volatile room state |
| Socket fan-out | Socket.IO + Redis adapter | Realtime synchronization |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| 3D rendering | Three.js, React Three Fiber, Drei |
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
Room ownership, registered users, profiles, and memberships are durable relational data. Presence, seats, chat, and music change frequently and use a separate realtime state model.

**Why Socket.IO instead of raw WebSockets?**  
VIBE needs rooms, reconnection handling, acknowledgements, and Redis-backed fan-out. Socket.IO provides those primitives without rebuilding them manually.

**Why REST and Socket.IO instead of GraphQL?**  
The persistent API surface is predictable and relatively small. REST handles CRUD while Socket.IO handles realtime state, keeping responsibilities clear.

**Why a modular monolith first?**  
The current system does not need independent microservice deployment or Kafka. A modular NestJS backend keeps the architecture simpler while preserving service boundaries.

**Why Redis for capacity and presence?**  
The product limit applies to people actively occupying a room, not people who have historically joined it. Redis fits the high-frequency, ephemeral ownership model.

**Why atomic capacity and seat mutations?**  
A separate read-then-write sequence could admit too many users or allow two participants to claim the same seat during concurrent requests.

**Why are guests not Prisma users?**  
Guest identities are intentionally temporary. Creating permanent rows for anonymous visitors would blur the distinction between durable accounts and ephemeral participation.

**Why does opening a room not count as joining?**  
A viewer should be able to inspect a room without taking one of the active participant slots.

**Why keep Google identity separate from VIBE identity?**  
Authentication identity and public product identity serve different purposes. Users should control the display name and avatar other participants see.

**Why are seats server-authoritative now?**  
Once the product supports multiple renderers and multiple browsers viewing the same room, seat placement becomes shared application state rather than a local presentation concern. Redis presence now owns `seatId`, and both 2D and 3D consume the same value.

**Why build 3D as a rendering layer instead of a separate room system?**  
Chat, presence, DMs, seats, music, and identity already define the room model. The 3D scene reuses those contracts and only changes presentation, which avoids duplicate backend state and keeps 2D/3D behavior consistent.

**Why keep complex controls in HTML instead of WebGL?**  
Chat drawers, DM panels, music controls, and participant action menus benefit from normal DOM accessibility and layout. The Three.js layer focuses on spatial representation and lightweight interactions.

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

### Production builds

```bash
pnpm --filter server build
pnpm --filter web build
```

---

## 🔌 API Overview

### Identity endpoints

```text
POST  /auth/guest
POST  /auth/registered
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
│   │   │   ├── room-dm.tsx
│   │   │   ├── room-music.tsx
│   │   │   ├── room-occupancy.tsx
│   │   │   ├── room-presence.tsx
│   │   │   ├── room-3d-scene.tsx
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
│   │   │       ├── chat.ts
│   │   │       └── dm.ts
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
- [x] Low-poly 3D avatar renderer

### Presence, capacity, and shared seats

- [x] Redis-backed live presence
- [x] Watch-room vs enter-room semantics
- [x] Refresh-safe presence deduplication
- [x] Guest active-room restoration after refresh
- [x] Presence heartbeat
- [x] Stale-presence cleanup
- [x] Atomic 12-person active-room capacity
- [x] Server-authoritative seat assignment
- [x] Atomic seat movement
- [x] Same-user seat preservation across reconnects
- [x] Cross-browser seat synchronization

### 2D spatial room

- [x] Spatial room canvas
- [x] Fixed 12-seat layout
- [x] Participant avatars
- [x] Shared seat state
- [x] User-selectable empty seats
- [x] Occupied-seat protection
- [x] Current-user visual distinction
- [x] Participant online indicators
- [x] Speech bubbles
- [x] Participant interaction menus

### 3D spatial room

- [x] Three.js / React Three Fiber integration
- [x] 2D / 3D room toggle
- [x] Fixed 12-seat 3D layout
- [x] Physical 3D chairs
- [x] Low-poly participant avatars
- [x] Shared server-authoritative seat rendering
- [x] Click-to-move 3D seating
- [x] Clickable 3D participants
- [x] Selected-participant visual state
- [x] 3D participant action card
- [x] 3D unread DM indicator
- [x] 3D chat speech bubbles
- [x] Click bubble to open chat
- [ ] Final responsive/WebGL/performance polish

### Chat and room interaction

- [x] Redis-backed realtime room chat
- [x] Temporary 24-hour chat history
- [x] Latest-50-message retention
- [x] Compact in-room chat drawer
- [x] 2D avatar speech bubbles
- [x] 3D avatar speech bubbles
- [x] Unread chat indicator
- [x] `@` mention autocomplete
- [x] Mention highlighting
- [x] Mention counter
- [x] In-room mention notifications
- [x] Participant interaction menu
- [x] One-click participant mention action

### Ephemeral DMs

- [x] Active-participant DM validation
- [x] Recipient lookup through presence
- [x] Sender/recipient-only delivery
- [x] Temporary per-conversation frontend state
- [x] Per-conversation unread counts
- [x] Participant Message action
- [x] 2D DM entry point
- [x] 3D DM entry point
- [x] No persistent DM storage

### Shared music

- [x] Redis-backed shared music state
- [x] Owner/participant music permissions
- [x] Compact in-room music popover
- [x] Realtime music-state updates
- [x] YouTube URL validation
- [x] Embedded YouTube playback
- [x] Shared play synchronization
- [x] Shared pause synchronization
- [x] Shared seek synchronization
- [x] Playback revision ordering
- [x] Reconnect synchronization
- [x] Drift correction
- [x] Personal mute
- [x] Persistent player mount while UI is hidden
- [x] Clear current track

### Remaining product work

- [ ] Final 3D responsive/mobile polish
- [ ] WebGL fallback/error handling
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
- [ ] Seat contention/concurrency tests
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
- Seat movement is authorized through active presence/socket ownership
- DM sender and recipient are resolved server-side
- DMs are delivered only to involved sockets
- Music mutations validate active presence and room permissions
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
Shared seat state
      ≠
Rendering mode
```

A Google account proves who a registered user is.

A VIBE profile determines how that person appears to other participants.

PostgreSQL membership records who durably belongs to a room.

Redis presence determines whether that person is occupying the room right now.

Redis presence also carries the participant's current logical `seatId`, making spatial position shared application state.

The 2D and 3D renderers interpret that same logical room state differently without creating separate backends.

That separation keeps durable data, realtime state, and visual presentation from becoming unnecessarily coupled.

---

## License

MIT

---

> Built as a realtime social-room platform combining persistent PostgreSQL ownership, temporary guest and registered JWT identities, Redis-backed presence/chat/seat/music state, atomic capacity and seat enforcement, Socket.IO synchronization, ephemeral private DMs, synchronized YouTube playback, preset avatars, shared 2D/3D spatial seating, realtime mentions, participant interactions, and low-poly 3D rooms in a Next.js + NestJS monorepo.
