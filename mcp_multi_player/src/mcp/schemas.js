// The allowed shape of every tool's input and output (spec §10.2). The SDK checks calls
// against these before any game code runs; the engine then checks the game rules.

import * as z from 'zod';

const slot = z.string().regex(/^[A-Z][0-9]{1,2}$/).describe('Slot id, e.g. D5');
const requestId = z.string().min(1).max(100).describe('A new unique id for every change you make. Retry with the same id and arguments after a network error.');

export const action = z.discriminatedUnion('type', [
  z.object({ type: z.literal('build'), slot, tower: z.string().min(1).max(20).describe('Tower type, e.g. laser, cannon, cryo') }),
  z.object({ type: z.literal('upgrade'), slot, stat: z.enum(['damage', 'rate', 'range']).describe('Which stat gets +20% of the tower\'s base value') }),
  z.object({ type: z.literal('target'), slot, rule: z.enum(['first', 'strongest', 'weakest', 'fastest']) }),
]);

const player = z.string().min(1).max(20).describe('Your player id from your join reply (it is in next.args of every reply)');

export const rulesInput = z.object({});
export const joinInput = z.object({
  name: z.string().min(1).max(32).describe('The model you are, as people know it, e.g. "Claude Opus 5.5" or "Codex Sol 6.1" (1-32 characters: letters, digits, spaces and . _ - ( ))'),
  understood: z.literal(true).describe('Set to true to confirm you have read the rules tool: the map, how health and leaks work, how damage is worked out'),
  player: player.optional().describe('Leave out the first time. Give your player id only to rejoin after an interruption.'),
  request_id: requestId.optional(),
});
export const stateInput = z.object({
  player: player.optional().describe('Your player id. Without it you only see whether a series is open and whether to join.'),
  since: z.string().max(80).optional().describe('The cursor from your last reply; with wait_s, waits until something changes'),
  wait_s: z.number().min(0).max(25).optional().describe('Seconds to wait for a change (max 25)'),
});
export const actInput = z.object({
  player,
  for_version: z.number().int().min(1).describe('The version from your last state reply (next.args.for_version)'),
  request_id: requestId,
  actions: z.array(action).max(30).describe('Ordered actions for the coming wave; an empty list saves gold'),
});
export const readyInput = z.object({
  player,
  for_match: z.number().int().min(2).describe('The next match number (next.args.for_match)'),
  request_id: requestId.optional(),
});

/** Every reply is an object with ok and a next step; the rest depends on the tool. */
export const replyOutput = z.looseObject({
  ok: z.boolean(),
  next: z.looseObject({ tool: z.string() }).optional(),
});
