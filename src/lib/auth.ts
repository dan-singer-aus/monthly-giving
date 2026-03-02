export type Auth = {
  getSessionUserId: (req: Request) => Promise<string | null>;
};

type UsersRepoForAdmin = {
  getById: (id: string) => Promise<{ role: string } | null>;
};

export async function requireUser(
  req: Request,
  auth: Auth
): Promise<
  { success: false; response: Response } | { success: true; userId: string }
> {
  const userId = await auth.getSessionUserId(req);
  if (!userId) {
    return {
      success: false,
      response: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  return { success: true, userId };
}

export async function requireAdmin(
  req: Request,
  auth: Auth,
  usersRepo: UsersRepoForAdmin
): Promise<
  { success: false; response: Response } | { success: true; userId: string }
> {
  const authResult = await requireUser(req, auth);
  if (!authResult.success) return authResult;

  const requestingUser = await usersRepo.getById(authResult.userId);
  if (!requestingUser || requestingUser.role !== 'admin') {
    return {
      success: false,
      response: Response.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }
  return { success: true, userId: authResult.userId };
}
