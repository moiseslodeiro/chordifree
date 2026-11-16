import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { Firestore } from '@google-cloud/firestore';
import { GoogleAuth, OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import type { AccessEntry, AuthUser } from '@chordifree/contracts';
import type { AppConfig } from '../config';
import { ApiError } from '../errors';

export type { AccessEntry, AuthUser } from '@chordifree/contracts';

export interface AccessStore {
  isAllowed(email: string): Promise<boolean>;
  list(): Promise<AccessEntry[]>;
  add(email: string, addedBy: string): Promise<AccessEntry>;
  remove(email: string): Promise<boolean>;
}

export interface AuthContext {
  mode: 'none' | 'google';
  clientId: string;
  verifyToken(token: string): Promise<AuthUser>;
  isAllowed(user: AuthUser): Promise<boolean>;
  isAdmin(user: AuthUser): boolean;
  access: AccessStore;
}

export interface AuthOverrides {
  verifyToken?: (token: string) => Promise<AuthUser>;
  access?: AccessStore;
}

const LOCAL_USER: AuthUser = {
  uid: 'local',
  email: 'local@localhost',
  name: 'Local user',
};

export class MemoryAccessStore implements AccessStore {
  private readonly entries = new Map<string, AccessEntry>();

  async isAllowed(email: string): Promise<boolean> {
    return this.entries.has(normalizeEmail(email));
  }

  async list(): Promise<AccessEntry[]> {
    return [...this.entries.values()].sort((a, b) => a.email.localeCompare(b.email));
  }

  async add(email: string, addedBy: string): Promise<AccessEntry> {
    const normalized = normalizeEmail(email);
    const entry: AccessEntry = {
      email: normalized,
      addedAt: new Date().toISOString(),
      ...(addedBy ? { addedBy } : {}),
    };
    this.entries.set(normalized, entry);
    return entry;
  }

  async remove(email: string): Promise<boolean> {
    return this.entries.delete(normalizeEmail(email));
  }
}

export class FirestoreAccessStore implements AccessStore {
  private readonly collection;

  constructor(
    private readonly firestore: Firestore,
    collectionName = 'chordifree_access',
  ) {
    this.collection = this.firestore.collection(collectionName);
  }

  async isAllowed(email: string): Promise<boolean> {
    const snapshot = await this.collection.doc(normalizeEmail(email)).get();
    return snapshot.exists && snapshot.get('allowed') !== false;
  }

  async list(): Promise<AccessEntry[]> {
    const snapshot = await this.collection.orderBy('email').get();
    return snapshot.docs.map((doc) => {
      const data = doc.data() as { email?: string; addedAt?: string; addedBy?: string };
      return {
        email: data.email ?? doc.id,
        addedAt: data.addedAt ?? '',
        ...(data.addedBy ? { addedBy: data.addedBy } : {}),
      };
    });
  }

  async add(email: string, addedBy: string): Promise<AccessEntry> {
    const normalized = normalizeEmail(email);
    const entry: AccessEntry = {
      email: normalized,
      addedAt: new Date().toISOString(),
      ...(addedBy ? { addedBy } : {}),
    };
    await this.collection.doc(normalized).set({ ...entry, allowed: true }, { merge: true });
    return entry;
  }

  async remove(email: string): Promise<boolean> {
    const ref = this.collection.doc(normalizeEmail(email));
    const snapshot = await ref.get();
    if (!snapshot.exists) return false;
    await ref.delete();
    return true;
  }
}

export function createFirestore(config: AppConfig): Firestore {
  return new Firestore({
    ...(config.googleCloudProject ? { projectId: config.googleCloudProject } : {}),
    databaseId: config.firestoreDatabase,
  });
}

export function createAuthContext(config: AppConfig, overrides: AuthOverrides = {}): AuthContext {
  const adminEmails = new Set(config.adminEmails.map(normalizeEmail));
  const access =
    overrides.access ??
    (config.authMode === 'google'
      ? new FirestoreAccessStore(createFirestore(config))
      : new MemoryAccessStore());

  const verifyToken =
    overrides.verifyToken ??
    (config.authMode === 'google'
      ? createGoogleVerifier(config.googleClientId)
      : async () => LOCAL_USER);

  return {
    mode: config.authMode,
    clientId: config.googleClientId,
    verifyToken,
    async isAllowed(user) {
      if (config.authMode !== 'google') return true;
      if (adminEmails.has(normalizeEmail(user.email))) return true;
      return access.isAllowed(user.email);
    },
    isAdmin(user) {
      return config.authMode !== 'google' || adminEmails.has(normalizeEmail(user.email));
    },
    access,
  };
}

export function createGoogleVerifier(clientId: string): (token: string) => Promise<AuthUser> {
  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID is required when AUTH_MODE=google');
  }
  const client = new OAuth2Client(clientId);
  return async (token) => {
    try {
      const ticket = await client.verifyIdToken({ idToken: token, audience: clientId });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email || payload.email_verified !== true) {
        throw new Error('Google token without a verified email');
      }
      return {
        uid: payload.sub,
        email: normalizeEmail(payload.email),
        ...(payload.name ? { name: payload.name } : {}),
        ...(payload.picture ? { picture: payload.picture } : {}),
      };
    } catch {
      throw new ApiError('UNAUTHENTICATED', 'The Google session is not valid');
    }
  };
}

/** Returns an ID token for a Cloud Run or IAM-protected service. */
export function createGoogleIdTokenProvider(audience: string): () => Promise<string> {
  const auth = new GoogleAuth();
  let clientPromise: ReturnType<GoogleAuth['getIdTokenClient']> | null = null;
  return async () => {
    clientPromise ??= auth.getIdTokenClient(audience);
    const client = await clientPromise;
    const headers = await client.getRequestHeaders(audience);
    const value =
      typeof (headers as { get?: (name: string) => string | null }).get === 'function'
        ? (headers as { get: (name: string) => string | null }).get('authorization')
        : ((headers as { Authorization?: string; authorization?: string }).Authorization ??
          (headers as { authorization?: string }).authorization ??
          null);
    if (!value?.startsWith('Bearer ')) {
      throw new Error('Could not obtain a Google ID token');
    }
    return value.slice('Bearer '.length);
  };
}

export function bearerToken(req: Request): string | null {
  const header = req.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}

/** Verifies the token but does not require the account to be allowed yet. */
export function authenticateUser(auth: AuthContext) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (auth.mode === 'none') {
        req.authUser = LOCAL_USER;
        next();
        return;
      }
      const token = bearerToken(req);
      if (!token) throw new ApiError('UNAUTHENTICATED', 'Sign in with Google to continue');
      req.authUser = await auth.verifyToken(token);
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Verifies the token and rejects accounts that are not on the allowlist. */
export function requireAllowed(auth: AuthContext) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (auth.mode === 'none') {
        req.authUser = LOCAL_USER;
        next();
        return;
      }
      const token = bearerToken(req);
      if (!token) throw new ApiError('UNAUTHENTICATED', 'Sign in with Google to continue');
      const user = await auth.verifyToken(token);
      if (!(await auth.isAllowed(user))) {
        throw new ApiError('NOT_ALLOWED', 'This account is not allowed to use this instance');
      }
      req.authUser = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireAdmin(auth: AuthContext) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.authUser) {
      next(new ApiError('UNAUTHENTICATED', 'Sign in with Google to continue'));
      return;
    }
    if (!auth.isAdmin(req.authUser)) {
      next(new ApiError('ADMIN_ONLY', 'Administrator access is required'));
      return;
    }
    next();
  };
}

const EmailSchema = z.object({ email: z.string().trim().email() });

export function createAuthRouter(auth: AuthContext): Router {
  const router = Router();

  router.get('/config', (_req, res) => {
    res.json({
      mode: auth.mode,
      ...(auth.mode === 'google' ? { clientId: auth.clientId } : {}),
    });
  });

  router.get('/me', authenticateUser(auth), async (req, res, next) => {
    try {
      const user = req.authUser!;
      res.json({
        user,
        allowed: await auth.isAllowed(user),
        admin: auth.isAdmin(user),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export function createAdminRouter(auth: AuthContext): Router {
  const router = Router();
  router.use(authenticateUser(auth), requireAdmin(auth));

  router.get('/access', async (_req, res, next) => {
    try {
      res.json({ entries: await auth.access.list() });
    } catch (error) {
      next(error);
    }
  });

  router.post('/access', async (req, res, next) => {
    try {
      const parsed = EmailSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ApiError('INVALID_REQUEST', 'A valid email address is required');
      }
      const entry = await auth.access.add(parsed.data.email, req.authUser!.email);
      res.status(201).json({ entry });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/access/:email', async (req, res, next) => {
    try {
      const parsed = EmailSchema.safeParse({ email: req.params.email });
      if (!parsed.success) {
        throw new ApiError('INVALID_REQUEST', 'A valid email address is required');
      }
      const removed = await auth.access.remove(parsed.data.email);
      if (!removed) throw new ApiError('NOT_FOUND', 'That account is not on the allowlist');
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}
