import type { Phase, RoomType } from "./database";
export type { Phase, RoomType };

export interface Player {
  id: string;
  nickname: string;
  lives: number;
  alive: boolean;
  connected: boolean;
  isHost: boolean;
  team?: "A" | "B" | null;
}

export interface RoomState {
  room: {
    code: string;
    name: string;
    roomType: RoomType;
    phase: Phase;
    round: number;
    deadline: string | null;
    lives: number;
    writeSec: number;
    maxPlayers: number;
    hostId: string | null;
    imageSource?: "LIBRARY" | "CUSTOM";
    imageCategory?: string;
    gameMode?: "SOLO" | "TEAM";
  };
  players: Player[];
  me: {
    playerId: string;
    alive: boolean;
    submitted: boolean;
    voted: boolean;
  };
  image?: { url: string };
  submissions?: Array<{ id: string; title: string }>;
  result?: {
    ranking: Array<{ id: string; title: string; author: string; votes: number; aiScore: number }>;
    eliminated: string[];
    losers: string[];
  };
}

export interface ApiError {
  error: { code: string; message: string };
}

export const ERROR_CODES = {
  ROOM_NOT_FOUND: "ROOM_NOT_FOUND",
  ROOM_FULL: "ROOM_FULL",
  WRONG_PASSWORD: "WRONG_PASSWORD",
  PASSWORD_COOLDOWN: "PASSWORD_COOLDOWN",
  NOT_HOST: "NOT_HOST",
  NOT_ENOUGH_PLAYERS: "NOT_ENOUGH_PLAYERS",
  DEADLINE_PASSED: "DEADLINE_PASSED",
  PHASE_MISMATCH: "PHASE_MISMATCH",
  CANNOT_VOTE_SELF: "CANNOT_VOTE_SELF",
  ALREADY_VOTED: "ALREADY_VOTED",
  CHAT_LOCKED: "CHAT_LOCKED",
  RATE_LIMITED: "RATE_LIMITED",
} as const;
