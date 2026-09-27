import { z } from 'zod';
import { actionEnvelopeSchema } from '@kittens/shared';

export const nicknameSchema = z.string().trim().min(1).max(24);
export const roomCodeSchema = z.string().trim().toUpperCase().regex(/^[A-HJ-NP-Z2-9]{6}$/);
export const roomOptionsSchema = z.object({
  mode: z.enum(['BASE', 'EXTENDED']),
  resurrection: z.boolean(),
}).strict();

export const inboundSchemas = {
  'session:open': z.object({ token: z.string().length(64).regex(/^[a-f0-9]+$/).optional(), nickname: nicknameSchema.optional() }).strict(),
  'room:create': z.object({ options: roomOptionsSchema.optional() }).strict(),
  'room:join': z.object({ roomCode: roomCodeSchema }).strict(),
  'room:watch': z.object({ roomCode: roomCodeSchema }).strict(),
  'room:leave': z.object({}).strict(),
  'room:ready': z.object({ ready: z.boolean() }).strict(),
  'room:settings': z.object({ options: roomOptionsSchema }).strict(),
  'room:start': z.object({}).strict(),
  'room:rematch': z.object({}).strict(),
  'room:chat': z.object({ text: z.string().trim().min(1).max(240) }).strict(),
  'room:choose-defuse': z.object({ gameId: z.string().uuid(), cardId: z.string().min(1).max(80), actionId: z.string().uuid() }).strict(),
  'room:throw': z.object({ targetId: z.string().uuid(), prop: z.enum(['EGG','BOMB','ROCK']), actionId: z.string().uuid() }).strict(),
  'room:sync': z.object({}).strict(),
  'game:action': actionEnvelopeSchema,
} as const;

export type RoomOptions = z.infer<typeof roomOptionsSchema>;
export type EventName = keyof typeof inboundSchemas;
