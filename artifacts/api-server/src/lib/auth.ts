import crypto from "crypto";
import jwt from "jsonwebtoken";
import { type Request, type Response } from "express";
import type { AuthUser } from "@workspace/api-zod";

export const SESSION_COOKIE = "sid";
export const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET must be set for signing session tokens.");
  }
  return secret;
}

/** The single admin user this dashboard exposes. */
export function getAdminUser(): AuthUser {
  return {
    id: "admin",
    email: process.env.ADMIN_EMAIL || null,
    firstName: "Admin",
    lastName: null,
    profileImageUrl: null,
  };
}

/** Constant-time comparison of the submitted password against ADMIN_PASSWORD. */
export function verifyPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    throw new Error("ADMIN_PASSWORD must be set.");
  }
  const a = Buffer.from(String(password));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function createToken(user: AuthUser): string {
  return jwt.sign({ user }, getSecret(), { expiresIn: "7d" });
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, getSecret()) as { user?: AuthUser };
    return decoded.user ?? null;
  } catch {
    return null;
  }
}

export function getToken(req: Request): string | undefined {
  const authHeader = req.headers["authorization"];
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return req.cookies?.[SESSION_COOKIE];
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}
