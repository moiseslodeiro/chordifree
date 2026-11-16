import { Router } from 'express';
import { ApiError } from '../errors';
import type { AuthContext } from '../services/auth';
import type { CloudLibraryStore } from '../services/cloud-library';

/**
 * Delete the signed-in user's cloud library. Non-admins also lose their
 * allowlist entry; administrators keep access because they are declared in
 * ADMIN_EMAILS and may need to keep managing the instance.
 */
export function createAccountRouter(
  auth: AuthContext,
  store: CloudLibraryStore | null,
): Router {
  const router = Router();

  router.delete('/', async (req, res, next) => {
    try {
      if (!store) {
        throw new ApiError('CLOUD_DISABLED', 'The cloud library is not enabled');
      }
      const user = req.authUser;
      if (!user) {
        throw new ApiError('UNAUTHENTICATED', 'Sign in with Google to continue');
      }

      const counts = await store.clear(user.uid);
      const isAdmin = auth.isAdmin(user);
      const accessRemoved = isAdmin ? false : await auth.access.remove(user.email);

      console.info(
        `[account] ${user.uid} cleared cloud data ` +
          `(songs=${counts.songs}, setlists=${counts.setlists}, accessRemoved=${accessRemoved})`,
      );

      res.json({
        deleted: true,
        songs: counts.songs,
        setlists: counts.setlists,
        accessRemoved,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
