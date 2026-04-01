/**
 * Session Manager
 *
 * Tracks active TN3270 sessions and handles lifecycle management.
 */

import { WebSocket } from 'ws';
import { Session, type SessionConfig } from './session.js';

let nextId = 1;

export class SessionManager {
  private sessions = new Map<string, Session>();

  /**
   * Create a new session for a WebSocket connection.
   */
  async createSession(ws: WebSocket, config: SessionConfig): Promise<Session> {
    const id = `session-${nextId++}`;
    const session = new Session(id, ws);
    this.sessions.set(id, session);
    console.log(`[session-manager] created ${id} for ${config.host}:${config.port}`);

    try {
      await session.connect(config);
      console.log(`[session-manager] ${id} connected`);
    } catch {
      this.sessions.delete(id);
      console.error(`[session-manager] ${id} failed, removed`);
      throw new Error(`Failed to connect to ${config.host}:${config.port}`);
    }

    return session;
  }

  /**
   * Remove a session.
   */
  destroySession(id: string): void {
    const session = this.sessions.get(id);
    if (session) {
      console.log(`[session-manager] destroying ${id}`);
      session.cleanup();
      this.sessions.delete(id);
    }
  }

  /**
   * Get a session by ID.
   */
  getSession(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  /**
   * Get the number of active sessions.
   */
  get activeCount(): number {
    return this.sessions.size;
  }

  /**
   * Clean up all sessions.
   */
  destroyAll(): void {
    console.log(`[session-manager] destroying all sessions (${this.sessions.size})`);
    for (const [id, session] of this.sessions) {
      session.cleanup();
      this.sessions.delete(id);
    }
  }
}
