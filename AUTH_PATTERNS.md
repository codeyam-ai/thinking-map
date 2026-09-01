# Auth Patterns for Dev Prototyping

This project uses a simple cookie + database auth pattern designed for local development.
It is **intentionally simple** — built for easy upgrade to a real provider later.

## DO NOT use external auth providers during prototyping

**Do NOT use NextAuth, Auth.js, Clerk, better-auth, Supabase Auth, or any external auth provider.**

These providers require external infrastructure (OAuth endpoints, JWT signing keys, callback URLs)
that is unavailable in the local SQLite development environment. They will fail silently or produce
confusing errors. Use the pattern below instead — it works immediately and upgrades cleanly later.

See `AUTH_UPGRADE.md` for how to swap in a real provider when going to production.

## Interfaces

All consumer code imports from `@/app/lib/auth`. The interface is:

```typescript
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export interface Session {
  user: AuthUser;
}

export async function getSession(): Promise<Session | null>;
export async function requireAuth(): Promise<Session>; // redirects to /login if no session
export async function signIn(
  email: string,
  password: string,
): Promise<Session | null>;
export async function signOut(): Promise<void>;
```

## Prisma Schema Additions

Add these models to `prisma/schema.prisma`:

```prisma
model User {
  id        String    @id @default(cuid())
  name      String
  email     String    @unique
  password  String
  image     String?
  sessions  Session[]
  createdAt DateTime  @default(now())
}

model Session {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
}
```

After editing the schema, run: `npm run db:push`

## Dev Implementation: `app/lib/auth.ts`

```typescript
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/app/lib/prisma';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export interface Session {
  user: AuthUser;
}

const COOKIE_NAME = 'session-token';

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session) return null;

  return {
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
    },
  };
}

export async function requireAuth(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}

export async function signIn(
  email: string,
  password: string,
): Promise<Session | null> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.password !== password) return null;

  const token = crypto.randomUUID();
  await prisma.session.create({
    data: { token, userId: user.id },
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
    },
  };
}

export async function signOut(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }
  cookieStore.delete(COOKIE_NAME);
}
```

## Cookie Name

Use `session-token` as the cookie name. Keeping it consistent across scaffolds
makes auth debugging predictable: if a page 401s, you always know which cookie
to look for in the browser devtools.

Note: automatic browser cookie injection from scenario JSON is not currently
wired. For scenarios that need an authenticated session, seed the User and
Session rows in the DB (see "Seed Data for Scenarios" below) and log in
through the app's `/login` flow in the preview when the scenario first loads.

## API Routes

### `/api/auth/login` (POST)

```typescript
import { signIn } from '@/app/lib/auth';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { email, password } = await request.json();
  const session = await signIn(email, password);
  if (!session) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }
  return NextResponse.json({ user: session.user });
}
```

### `/api/auth/logout` (POST)

```typescript
import { signOut } from '@/app/lib/auth';
import { NextResponse } from 'next/server';

export async function POST() {
  await signOut();
  return NextResponse.json({ success: true });
}
```

### `/api/auth/session` (GET) — for client components

```typescript
import { getSession } from '@/app/lib/auth';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await getSession();
  return NextResponse.json({ session });
}
```

## Usage in Server Components

```typescript
import { getSession } from '@/app/lib/auth';

export default async function Dashboard() {
  const session = await getSession();
  if (!session) redirect('/login');

  return <h1>Welcome, {session.user.name}</h1>;
}
```

## Usage in Client Components

```typescript
'use client';
import { useEffect, useState } from 'react';

export function UserNav() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => setUser(data.session?.user ?? null));
  }, []);

  if (!user) return <a href="/login">Sign In</a>;

  return (
    <div>
      <span>{user.name}</span>
      <button onClick={() => {
        fetch('/api/auth/logout', { method: 'POST' })
          .then(() => window.location.href = '/');
      }}>
        Sign Out
      </button>
    </div>
  );
}
```

## Login Page Pattern

```typescript
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      router.push('/');
      router.refresh();
    } else {
      setError('Invalid email or password');
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required />
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button type="submit">Sign In</button>
    </form>
  );
}
```

## Seed Data for Scenarios

When creating scenarios with auth, include both `User` and `Session` rows in seed data:

```json
{
  "name": "Logged In User",
  "scenarioType": "application",
  "url": "/",
  "pageFilePath": "app/page.tsx",
  "dimensions": ["Desktop"],
  "seed": {
    "user": [
      {
        "id": "user_1",
        "name": "Alice",
        "email": "alice@example.com",
        "password": "password123"
      }
    ],
    "session": [{ "id": "sess_1", "token": "sess_alice", "userId": "user_1" }]
  }
}
```

`ScenarioDefinition` does not have a top-level `session` field — the seeded
`session` table row above is what makes the app's server-side `getSession()`
lookup succeed. The browser still needs the `session-token` cookie set for
the lookup to fire; since automatic cookie injection from scenarios is not
wired yet, drive login through the app's `/login` page in the preview the
first time you load a logged-in scenario.
