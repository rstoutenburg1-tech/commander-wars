import type { MatchSettings } from '../game/match';
import type { World } from '../game/types';
import type { GameAction } from '../game/actions';
export type { GameAction } from '../game/actions';
export interface LobbyMember { id: string; seat: number; name: string; ready: boolean; connected: boolean }
export interface LobbyState {
  code: string; hostId: string; phase: 'lobby' | 'playing' | 'finished';
  settings: MatchSettings; members: LobbyMember[]; revision: number;
}
export type ClientMessage =
  | { type: 'create'; name: string; settings?: MatchSettings }
  | { type: 'join'; code: string; name: string }
  | { type: 'resume'; code: string; token: string }
  | { type: 'configure'; settings: MatchSettings }
  | { type: 'team'; alliance: number }
  | { type: 'ready'; ready: boolean }
  | { type: 'start' }
  | { type: 'action'; action: GameAction; sequence: number }
  | { type: 'ping'; sent: number }
  | { type: 'leave' };
export type ServerMessage =
  | { type: 'welcome'; id: string; token: string; seat: number; lobby: LobbyState }
  | { type: 'lobby'; lobby: LobbyState }
  | { type: 'start'; world: World; seat: number; ack?: number }
  | { type: 'snapshot'; world: World; ack?: number }
  | { type: 'actionResult'; sequence: number; accepted: boolean }
  | { type: 'pong'; sent: number }
  | { type: 'error'; message: string }
  | { type: 'left' };
