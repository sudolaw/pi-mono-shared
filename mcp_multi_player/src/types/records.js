// @ts-check
// Shapes for bookkeeping around the game (spec §6–§9). Type comments only; no runtime code.

/**
 * @typedef {import('./game.js').Seat} Seat
 * @typedef {import('./game.js').Level} Level
 * @typedef {import('./game.js').State} State
 *
 * @typedef {{ now(): number, setTimer(ms: number, fn: () => any): any, clearTimer(handle: any): void }} Clock  times in ms
 * @typedef {{ error?: (message: string) => void, warn?: (message: string) => void }} Log
 *
 * @typedef {{ over: true, winner: Seat|null, reason: string }} MatchResult
 * @typedef {{ append(kind: string, data: object, extra?: object): Promise<any>, audit(kind: string, data: object): Promise<any>,
 *   snapshot(turn: number, data: object): Promise<any>, text(line: string): Promise<any>, load(): Promise<any> }} MatchStore
 *   one match's files (spec §9); append is the commit point
 * @typedef {{ engine: typeof import('../engine/index.js'), store: MatchStore, clock: Clock, log?: Log }} MatchDeps
 * @typedef {{ id: string, seriesId: string, matchNo: number, level: Level, seed: number, deadlineS?: number,
 *   paceS?: number, missLimit?: number, intensity?: number, warmup?: boolean, maxWaves?: number,
 *   onEnd?: (end: MatchResult & { matchNo: number, cancelled: boolean, report: object, decisionMs: { P1: number[], P2: number[] } }) => void }} MatchOptions
 *   deadlineS: seconds per decision; paceS: seconds each wave stays on screen before the next may run;
 *   intensity: host tuning 0-10; warmup/maxWaves: the unscored warm-up (match 0) and its length
 * @typedef {'created'|'collecting'|'resolving'|'over'|'cancelled'} MatchPhase
 * @typedef {{ id: string, seriesId: string, matchNo: number, seed: number, levelHash: string, phase: MatchPhase,
 *   version: number, state: State|null, deadlineAt: number|null, misses: Record<Seat, number>,
 *   result: MatchResult|null, report: object|null, error: string|null }} MatchRecord
 *   version: 1 at start, +1 per resolved turn; deadlineAt: clock time in ms; error: why background work stopped
 * @typedef {{ match: number, phase: MatchPhase, version: number, wave: number, of: number, submitted: Record<Seat, boolean>,
 *   deadline_at: number|null, deadline_in_s: number|null, next_wave_in_s: number|null, deadline_s: number, pace_s: number,
 *   warmup: boolean, max_waves: number|null, intensity: number, extra_queued: number, misses: Record<Seat, number>,
 *   result: MatchResult|null, error: string|null }} MatchStatus
 *
 * @typedef {{ engine: typeof import('../engine/index.js'), clock: Clock, log?: Log,
 *   store: { append(kind: string, data: object): Promise<any>, load(): Promise<any[]>, match(n: number): MatchStore },
 *   matches: { create(opts: MatchOptions): any, restore(opts: MatchOptions): Promise<any> } }} SeriesDeps
 * @typedef {{ id: string, level: Level, target?: number, deadlineS?: number, paceS?: number, readyS?: number,
 *   gapS?: number, warmupWaves?: number, createdAt: number }} SeriesOptions
 *   target: wins needed (a restore reads it from the log); readyS: seconds before a seat is marked ready; gapS: shortest pause between matches
 * @typedef {'waiting'|'in_match'|'between'|'done'|'cancelled'} SeriesPhase
 * @typedef {{ id: string, levelId: string, levelHash: string, target: number, deadlineS: number, paceS: number,
 *   intensity: number, warmupWaves: number, warmup: { deadlineS: number, slowestMs: Record<Seat, number> }|null,
 *   createdAt: number, phase: SeriesPhase, matchNo: number, seats: Record<Seat, {name: string, playerId: string|null, joinedAt: number}|null>,
 *   removed: (string|null|undefined)[],
 *   score: { P1: number, P2: number, draws: number }, ready: Record<Seat, boolean>,
 *   history: { matchNo: number, seed: number, result: { winner: Seat|null, reason: string, cancelled: boolean } }[],
 *   winner: Seat|null, endReason: string|null, error: string|null }} SeriesRecord
 * @typedef {{ actions: import('./game.js').Action[] }} Pending
 * @typedef {{ seq: number, at: number, kind: string, data: any, stateHash?: string }} LogEntry
 */
export {};
