import { z } from 'zod';

export const AnalysisSourceSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('youtube'),
    videoId: z.string().min(1),
    title: z.string().optional(),
  }),
  z.object({
    type: z.literal('upload'),
    filename: z.string().min(1),
  }),
  z.object({
    type: z.literal('sheet'),
    filename: z.string().min(1),
  }),
]);

/**
 * The cloud payload only validates the fields the server needs to identify and
 * order documents. The rest of the song is stored as-is so the web app can add
 * presentation fields without a server deploy.
 */
export const CloudSongSchema = z
  .object({
    id: z.string().min(1),
    title: z.string(),
    updatedAt: z.string(),
  })
  .passthrough();

export const CloudSetlistSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    songIds: z.array(z.string()),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough();

export const CloudLibraryBodySchema = z.object({
  songs: z.array(CloudSongSchema).max(2000),
  setlists: z.array(CloudSetlistSchema).max(500),
});

export type CloudLibraryBody = z.infer<typeof CloudLibraryBodySchema>;

/** The server stores the song snapshot as-is and only validates its identity. */
export const CollabRevisionBodySchema = z
  .object({
    baseRevisionId: z.string().min(1),
    song: CloudSongSchema,
  })
  .strict();

export const CollabCreateBodySchema = z
  .object({
    song: CloudSongSchema,
  })
  .strict();

export const NicknameSchema = z
  .string()
  .trim()
  .min(2, 'The nickname needs at least 2 characters')
  .max(32, 'The nickname is too long')
  .regex(/^[\p{L}\p{N} ._'’-]+$/u, 'The nickname contains unsupported characters');

export const ProfileBodySchema = z.object({ nickname: NicknameSchema }).strict();

export type CollabRevisionBody = z.infer<typeof CollabRevisionBodySchema>;
export type CollabCreateBody = z.infer<typeof CollabCreateBodySchema>;
export type ProfileBody = z.infer<typeof ProfileBodySchema>;
