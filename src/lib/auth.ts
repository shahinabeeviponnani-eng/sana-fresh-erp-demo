import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secure_erp_enterprise_jwt_secret_2026';

export interface UserSession {
  id: number;
  email: string;
  name: string;
  role: string; // 'ADMIN' | 'MANAGER' | 'CASHIER' | 'SALES_REP' | 'INVENTORY_CLERK' | 'ACCOUNTANT'
}

export function signToken(payload: UserSession): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): UserSession | null {
  try {
    return jwt.verify(token, JWT_SECRET) as UserSession;
  } catch (err) {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function getUserFromRequest(req: NextRequest): UserSession | null {
  // Check Authorization Bearer header
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    return verifyToken(token);
  }

  // Check cookie
  const cookie = req.cookies.get('erp_token');
  if (cookie?.value) {
    return verifyToken(cookie.value);
  }

  return null;
}
