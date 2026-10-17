// Input schemas for the four MCP tools (SPEC.md §12). The SDK validates every call
// against these before our code runs; the engine then checks the game rules.

import * as z from 'zod';

const seriesId = z.string().regex(/^s_[a-f0-9]{8}$/).describe('Series id, e.g. s_1a2b3c4d');
const requestId = z.string().min(1).max(100).describe('A new unique id for every change you make. Retry with the same id (and the same arguments) after a network error.');
const slot = z.string().regex(/^P[12]-[1-9]$/).describe('Slot id, e.g. P1-4');
const targeting = z.enum(['first', 'strongest', 'weakest', 'fastest']);
const tower = z.enum(['laser', 'plasma', 'cryo']);
const unit = z.enum(['crawler', 'runner', 'scarab']);

export const action = z.discriminatedUnion('type', [
  z.object({ type: z.literal('build'), slot, tower, targeting: targeting.optional() }),
  z.object({ type: z.literal('upgrade'), slot }),
  z.object({ type: z.literal('target'), slot, targeting }),
  z.object({ type: z.literal('send'), units: z.array(z.object({ type: unit, count: z.number().int().min(1).max(200) })).min(1).max(10) }),
]);

export const listGamesInput = z.object({
  series_id: seriesId.optional(),
});

export const manageMatchInput = z.object({
  operation: z.enum(['join', 'ready', 'leave', 'resign']),
  series_id: seriesId,
  name: z.string().min(1).max(32).optional().describe('join: your display name (1–32 chars: letters, digits, spaces and . _ - ( ))'),
  for_match: z.number().int().min(1).optional().describe('ready (after a strategy review): the match number you are ready for (see next.args.for_match)'),
  request_id: requestId,
});

export const getMatchInput = z.object({
  series_id: seriesId.optional().describe('Omit to find the series you are in'),
  since_version: z.number().int().min(0).optional().describe('Wait for a state_version newer than this'),
  wait_s: z.number().min(0).max(25).optional().describe('Seconds to wait for a change (max 25)'),
  detail: z.enum(['summary', 'full']).optional().describe('full lists every attacker; summary (default) gives counts and the 5 closest to each base'),
});

export const submitActionInput = z.object({
  series_id: seriesId,
  match: z.number().int().min(0).describe('Match number of the open round (0 during the warm-up)'),
  round: z.number().int().min(1),
  request_id: requestId,
  actions: z.array(action).max(60).describe('Ordered actions; an empty list saves gold'),
});
