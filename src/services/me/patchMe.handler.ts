import { patchMeSchema } from '@/src/validators/me';
import { type Auth, requireUser } from '@/src/lib/auth';
import { validateBody } from '@/src/lib/validation';

type Role = 'user' | 'admin';

type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  graduationYear: number;
};

type UsersRepo = {
  updateById: (
    id: string,
    patch: {
      firstName?: string;
      lastName?: string;
      graduationYear?: number;
    }
  ) => Promise<User | null>;
};

export function makePatchMeHandler(props: {
  auth: Auth;
  usersRepo: UsersRepo;
}) {
  return async function PATCH(req: Request): Promise<Response> {
    const authResult = await requireUser(req, props.auth);
    if (!authResult.success) return authResult.response;
    const { userId } = authResult;

    const validationResult = await validateBody(req, patchMeSchema);
    if (!validationResult.success) return validationResult.response;

    const updatedUser = await props.usersRepo.updateById(
      userId,
      validationResult.data
    );
    if (!updatedUser) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    return Response.json(
      {
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          graduationYear: updatedUser.graduationYear,
          role: updatedUser.role,
        },
      },
      { status: 200 }
    );
  };
}
