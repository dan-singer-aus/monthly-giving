import { type Auth } from '@/src/lib/auth';

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
  getById: (id: string) => Promise<User | null>;
};

export function makeMeHandler(props: { auth: Auth; usersRepo: UsersRepo }) {
  return async function GET(req: Request): Promise<Response> {
    const userId = await props.auth.getSessionUserId(req);
    if (!userId) {
      return Response.json({ authenticated: false }, { status: 200 });
    }

    const user = await props.usersRepo.getById(userId);
    if (!user) {
      // This should be impossible if the auth and usersRepo are consistent,
      // but we handle it just in case.
      return Response.json({ authenticated: false }, { status: 200 });
    }

    return Response.json(
      {
        authenticated: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          graduationYear: user.graduationYear,
          role: user.role,
        },
      },
      { status: 200 }
    );
  };
}
