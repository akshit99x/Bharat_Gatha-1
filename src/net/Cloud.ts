import type { Profile } from '../core/Save';
import type { Question } from '../content/types';

/**
 * The optional class connection: join a teacher's class, keep progress in the cloud, and receive the class's
 * own questions. The game works without any of it, and keeps working if the server is unreachable.
 *
 * Where the API lives is set at build time with VITE_API_URL (empty means "the same address as the game", which
 * is right on Vercel). If it cannot be reached, `available()` says so and the class features simply do not show.
 */

const BASE: string = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const KEY = 'bharat-gatha:class';
const PUSH_EVERY_MS = 45_000;

export interface Membership {
  classCode: string;
  className: string;
  nickname: string;
  /** The student's secret: it is the only way back to their progress, so it is shown to them once and kept here. */
  studentCode: string;
}

export type SyncState = 'off' | 'synced' | 'saving' | 'offline' | 'newer-in-cloud';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly detail?: Record<string, unknown>,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit & { token?: string; timeout?: number } = {}): Promise<T> {
  const { token, timeout = 8000, headers, ...rest } = init;
  const ctl = new AbortController();
  const timer = window.setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...rest,
      signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    });
    if (res.status === 204) return undefined as T;
    const body = (await res.json().catch(() => null)) as { error?: Record<string, unknown> } | T | null;
    if (!res.ok) {
      const err = (body as { error?: Record<string, unknown> } | null)?.error ?? {};
      // FastAPI validation errors arrive as a list under `detail`; flatten the first to a sentence.
      const message = typeof err.message === 'string' ? err.message : `The server said ${res.status}.`;
      throw new ApiError(res.status, message, err);
    }
    return body as T;
  } finally {
    window.clearTimeout(timer);
  }
}

function read(): Membership | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Membership) : null;
  } catch {
    return null;
  }
}

function write(m: Membership | null): void {
  try {
    if (m) localStorage.setItem(KEY, JSON.stringify(m));
    else localStorage.removeItem(KEY);
  } catch {
    /* private window: the connection lasts only until the page closes */
  }
}

export class Cloud {
  state: SyncState = 'off';
  private member: Membership | null = read();
  private reachable: boolean | null = null;
  private lastPush = 0;
  private timer: number | null = null;
  private listeners = new Set<() => void>();
  private lastProfile: (() => Profile) | null = null;

  get membership(): Membership | null {
    return this.member;
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private set(state: SyncState): void {
    if (this.state === state) return;
    this.state = state;
    for (const fn of this.listeners) fn();
  }

  /** Can we reach the API at all? Asked once, and remembered. */
  async available(): Promise<boolean> {
    if (this.reachable !== null) return this.reachable;
    try {
      const h = await call<{ ok: boolean }>('/api/health', { timeout: 3500 });
      this.reachable = h.ok === true;
    } catch {
      this.reachable = false;
    }
    return this.reachable;
  }

  // ---------------------------------------------------------------- joining

  async classInfo(code: string): Promise<{ code: string; name: string; students: number }> {
    return call(`/api/classes/${encodeURIComponent(code.trim())}`);
  }

  async join(classCode: string, nickname: string): Promise<Membership> {
    const r = await call<{ student_code: string; nickname: string; class_code: string; class_name: string }>(
      `/api/classes/${encodeURIComponent(classCode.trim())}/join`,
      { method: 'POST', body: JSON.stringify({ nickname }) },
    );
    this.member = { classCode: r.class_code, className: r.class_name, nickname: r.nickname, studentCode: r.student_code };
    write(this.member);
    this.set('synced');
    return this.member;
  }

  /** Come back with a code on a new device. */
  async restore(studentCode: string): Promise<Membership> {
    const me = await call<{ nickname: string; class_code: string; class_name: string }>('/api/me', { token: studentCode.trim() });
    this.member = { classCode: me.class_code, className: me.class_name, nickname: me.nickname, studentCode: studentCode.trim().toUpperCase() };
    write(this.member);
    this.set('synced');
    return this.member;
  }

  /** Leave the class and ask the server to erase this student's saved progress. */
  async leave(): Promise<void> {
    const m = this.member;
    if (m) {
      try {
        await call('/api/me', { method: 'DELETE', token: m.studentCode });
      } catch (e) {
        // A student who cannot reach the server can still leave on this device; their code stays valid.
        if (!(e instanceof ApiError) || e.status >= 500) console.warn('[Cloud] leave: could not reach the server', e);
      }
    }
    this.member = null;
    write(null);
    this.set('off');
  }

  // ------------------------------------------------------------------ sync

  /** Remember how to read the current profile, so the page-hide handler can send it. */
  attach(getProfile: () => Profile): void {
    this.lastProfile = getProfile;
    if (this.member) this.set('synced');
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void this.push(getProfile(), { keepalive: true });
    });
  }

  /** Called after each save. Sends at most once every 45 seconds, and never twice at once. */
  schedule(profile: Profile): void {
    if (!this.member || this.state === 'newer-in-cloud') return;
    const wait = Math.max(0, this.lastPush + PUSH_EVERY_MS - Date.now());
    if (this.timer !== null) return;
    this.timer = window.setTimeout(() => {
      this.timer = null;
      void this.push(this.lastProfile ? this.lastProfile() : profile);
    }, wait);
  }

  async push(profile: Profile, opts: { force?: boolean; keepalive?: boolean } = {}): Promise<boolean> {
    const m = this.member;
    if (!m) return false;
    this.set('saving');
    try {
      await call('/api/me/progress', {
        method: 'PUT',
        token: m.studentCode,
        keepalive: opts.keepalive,
        body: JSON.stringify({ profile, force: opts.force === true }),
      });
      this.lastPush = Date.now();
      this.set('synced');
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) this.set('newer-in-cloud');
      else if (e instanceof ApiError && (e.status === 403 || e.status === 404)) {
        // The teacher removed this student, or the class was deleted: stop trying, keep playing.
        this.member = null;
        write(null);
        this.set('off');
      } else this.set('offline');
      return false;
    }
  }

  /** The saved profile, or null if nothing is saved yet. */
  async pull(): Promise<{ profile: Profile; clientUpdatedAt: number } | null> {
    const m = this.member;
    if (!m) return null;
    try {
      const r = await call<{ profile: Profile; client_updated_at: number }>('/api/me/progress', { token: m.studentCode });
      return { profile: r.profile, clientUpdatedAt: r.client_updated_at };
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  }

  /** The class's own questions, in the game's shape. Empty if not in a class or offline. */
  async questions(): Promise<Question[]> {
    const m = this.member;
    if (!m) return [];
    try {
      const rows = await call<Array<Question & { readingGrade?: number; warnings?: string[] }>>('/api/me/questions', { token: m.studentCode });
      return rows.map(({ readingGrade: _g, warnings: _w, ...q }) => ({ ...q, context: q.context ?? undefined }) as Question);
    } catch {
      return [];
    }
  }
}

export const cloud = new Cloud();
