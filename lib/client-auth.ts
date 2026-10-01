import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import prisma from './db';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'vtgst_super_secure_jwt_production_secret_key_2026_viver_tech'
);

export const CLIENT_SESSION_COOKIE = 'vtgst_client_session';

export interface ClientSession {
  clientUserId: string;
  partyId: string;
  companyId: string;
  mobile: string;
  name: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createClientSessionToken(session: ClientSession): Promise<string> {
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(JWT_SECRET);
}

export async function verifyClientSessionToken(token: string): Promise<ClientSession | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as ClientSession;
  } catch {
    return null;
  }
}

export const getCurrentClientUser = cache(async (): Promise<ClientSession | null> => {
  const cookieStore = await cookies();
  let token = cookieStore.get(CLIENT_SESSION_COOKIE)?.value;
  if (!token) {
    try {
      const headerStore = await headers();
      const authHeader = headerStore.get('authorization') || headerStore.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
      }
    } catch (_) {}
  }
  if (!token) return null;
  return verifyClientSessionToken(token);
});

export const getClientAuthContext = cache(async (companyId?: string) => {
  const session = await getCurrentClientUser();
  if (!session) return null;

  if (companyId && session.companyId !== companyId) {
    return null;
  }

  const clientUser = await prisma.clientUser.findUnique({
    where: { id: session.clientUserId },
    include: {
      party: {
        include: {
          state: true,
        },
      },
      company: {
        select: {
          id: true,
          name: true,
          legalName: true,
          logoUrl: true,
          phone: true,
          mobile: true,
          email: true,
          address: true,
          city: true,
          gstin: true,
          currencySymbol: true,
        },
      },
    },
  });

  if (!clientUser || !clientUser.isActive) return null;

  return {
    session,
    clientUser,
    party: clientUser.party,
    company: clientUser.company,
  };
});
