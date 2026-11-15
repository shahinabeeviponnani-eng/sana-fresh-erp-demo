// Edge-compatible auth — uses jose (JWT) + WebCrypto (password hashing)
// Replaces: jsonwebtoken + bcryptjs (both Node-only)
import { SignJWT, jwtVerify } from 'jose';
import { NextRequest } from 'next/server';

const getSecret = () => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET not set');
  return new TextEncoder().encode(s);
};

export interface UserSession {
  id: number;
  email: string;
  name: string;
  role: string;
  permissions?: string[];
}

export async function signToken(payload: UserSession): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .setIssuedAt()
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<UserSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as UserSession;
  } catch {
    return null;
  }
}

// WebCrypto PBKDF2 password hashing (Edge compatible, replaces bcryptjs)
const ITERATIONS = 100_000;
const KEY_LEN = 32;

async function deriveKey(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  );
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial, KEY_LEN * 8
  );
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBuf(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  return arr;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, salt);
  return `${bufToHex(salt.buffer)}:${bufToHex(key)}`;
}

export async function comparePassword(password: string, stored: string): Promise<boolean> {
  // Support legacy bcrypt hashes (start with $2) during migration
  if (stored.startsWith('$2')) {
    // bcrypt not available on Edge — reject legacy hashes after migration
    // During migration period: return false and force password reset
    return false;
  }
  const [saltHex, keyHex] = stored.split(':');
  if (!saltHex || !keyHex) return false;
  const salt = hexToBuf(saltHex);
  const derived = await deriveKey(password, salt);
  return bufToHex(derived) === keyHex;
}

export async function getUserFromRequest(req: NextRequest): Promise<UserSession | null> {
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return verifyToken(authHeader.split(' ')[1]);
  }
  const cookie = req.cookies.get('erp_token');
  if (cookie?.value) return verifyToken(cookie.value);
  return null;
}
