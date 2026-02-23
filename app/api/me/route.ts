import { makeMeHandler } from '@/src/services/me/me.handler';
import { auth } from '@/src/services/auth/auth.runtime';
import { usersRepo } from '@/src/repos/users.repo';

export const GET = makeMeHandler({ auth, usersRepo });
