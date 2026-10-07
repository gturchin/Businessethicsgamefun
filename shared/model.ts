export type Screen = 'lobby' | 'intro' | 'round' | 'round-results' | 'class-profile' | 'real-world' | 'method' | 'valley' | 'comparison' | 'poll' | 'poll-results' | 'ended';
export type Choice = string | number | string[];
export type Priorities = Record<'government' | 'business' | 'community' | 'environment' | 'economy', number>;
export type Strategy = 'public' | 'corporate' | 'community' | 'growth' | 'shared';
export interface PersonalResult { strategy: Strategy; priorities: Priorities }
export interface RoundStats { count: number; items?: { id: string; count: number; percent: number }[]; average?: number; bins?: number[] }
export interface Aggregates { rounds: Record<number, RoundStats>; strategies: Record<Strategy, number>; priorities: Priorities; completed: number; poll: RoundStats }
export interface PublicState {
  code: string; screen: Screen; round: number; votingOpen: boolean; epoch: number;
  joined: number; submitted: number; pollSubmitted: number; createdAt: number; endedAt?: number;
  answers?: Record<number, Choice>; pollAnswer?: string; result?: PersonalResult;
  aggregates?: Aggregates;
}
export interface HostState extends PublicState { connected: number; demo: boolean; sampleCount: number; aggregates: Aggregates }
export type Action = 'intro' | 'open' | 'close' | 'reveal' | 'next' | 'profile' | 'real-world' | 'method' | 'valley' | 'comparison' | 'poll' | 'poll-reveal' | 'end' | 'reset' | 'seed';
