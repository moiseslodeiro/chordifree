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
