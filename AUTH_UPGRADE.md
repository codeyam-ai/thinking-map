# Upgrading Auth for Production

The dev auth pattern in `app/lib/auth.ts` is designed for easy replacement.
All consumer code imports from `@/app/lib/auth` — only the internals of that file change.

## What Stays the Same

Every file that imports from `@/app/lib/auth` continues to work unchanged:

- Server components calling `getSession()` and `requireAuth()`
- Client components fetching `/api/auth/session`
- API routes using `signIn()` and `signOut()`
- Login/logout forms

## What Changes

Only `app/lib/auth.ts` internals. Replace the cookie+DB implementation with your chosen provider.

---

## NextAuth v5

### Install

```bash
npm install next-auth @auth/prisma-adapter
```

### Replace `app/lib/auth.ts`

```typescript
import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/app/lib/prisma';
import Credentials from 'next-auth/providers/credentials';
// Add other providers: Google, GitHub, etc.

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export interface Session {
  user: AuthUser;
}

const {
  auth,
  signIn: nextAuthSignIn,
  signOut: nextAuthSignOut,
} = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (credentials) => {
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });
        if (!user) return null;
        // In production, use bcrypt: await bcrypt.compare(password, user.password)
        return user;
      },
    }),
    // Add: Google({ clientId: ..., clientSecret: ... })
    // Add: GitHub({ clientId: ..., clientSecret: ... })
  ],
  session: { strategy: 'jwt' },
});

export async function getSession(): Promise<Session | null> {
  const session = await auth();
  if (!session?.user) return null;
  return {
    user: {
      id: session.user.id!,
      name: session.user.name!,
      email: session.user.email!,
      image: session.user.image,
    },
  };
}

export async function requireAuth(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    const { redirect } = await import('next/navigation');
    redirect('/login');
  }
  return session;
}

export async function signIn(
  email: string,
  password: string,
): Promise<Session | null> {
  try {
    await nextAuthSignIn('credentials', { email, password, redirect: false });
    return getSession();
  } catch {
    return null;
  }
}

export async function signOut(): Promise<void> {
  await nextAuthSignOut({ redirect: false });
}
```

### Add route handler

Create `app/api/auth/[...nextauth]/route.ts`:

```typescript
import { handlers } from '@/app/lib/auth';
export const { GET, POST } = handlers;
```

---

## better-auth

### Install

```bash
npm install better-auth
```

### Replace `app/lib/auth.ts`

```typescript
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from '@/app/lib/prisma';
import { cookies } from 'next/headers';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export interface Session {
  user: AuthUser;
}

const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'sqlite' }),
  emailAndPassword: { enabled: true },
});

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const session = await auth.api.getSession({
    headers: new Headers({ cookie: cookieStore.toString() }),
  });
  if (!session?.user) return null;
  return {
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image ?? null,
    },
  };
}

export async function requireAuth(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    const { redirect } = await import('next/navigation');
    redirect('/login');
  }
  return session;
}

export async function signIn(
  email: string,
  password: string,
): Promise<Session | null> {
  try {
    await auth.api.signInEmail({ body: { email, password } });
    return getSession();
  } catch {
    return null;
  }
}

export async function signOut(): Promise<void> {
  const cookieStore = await cookies();
  await auth.api.signOut({
    headers: new Headers({ cookie: cookieStore.toString() }),
  });
}
```

---

## Supabase Auth

### Install

```bash
npm install @supabase/supabase-js @supabase/ssr
```

### Replace `app/lib/auth.ts`

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export interface Session {
  user: AuthUser;
}

function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.then((c) => c.getAll()),
        setAll: (cookies) =>
          cookieStore.then((c) => {
            cookies.forEach(({ name, value, options }) =>
              c.set(name, value, options),
            );
          }),
      },
    },
  );
}

export async function getSession(): Promise<Session | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return {
    user: {
      id: user.id,
      name: user.user_metadata.name || user.email?.split('@')[0] || '',
      email: user.email!,
      image: user.user_metadata.avatar_url ?? null,
    },
  };
}

export async function requireAuth(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    const { redirect } = await import('next/navigation');
    redirect('/login');
  }
  return session;
}

export async function signIn(
  email: string,
  password: string,
): Promise<Session | null> {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return null;
  return getSession();
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}
```

### Environment variables

Add to `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## After Upgrading

1. Remove the `Session` model from `prisma/schema.prisma` (the provider manages sessions)
2. Keep the `User` model if your provider uses it, or migrate to the provider's user table
3. Run `npm run db:push` to apply schema changes
4. Test sign-in and sign-out flows
5. Update scenario seed data if the session table structure changed
