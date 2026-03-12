import { validateBody } from '@/src/lib/validation';
import { registerSchema } from '@/src/validators/auth';
import type { UsersRepo } from '@/src/repos/users.repo';
import type { SupabaseClient } from '@supabase/supabase-js';

type RegisterHandlerProps = {
  usersRepo: UsersRepo;
  supabase: SupabaseClient;
};

export function makeRegisterHandler({
  usersRepo,
  supabase,
}: RegisterHandlerProps) {
  return async function POST(req: Request) {
    const validationResult = await validateBody(req, registerSchema);
    if (!validationResult.success) return validationResult.response;

    const { email, password, firstName, lastName, graduationYear } =
      validationResult.data;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      if (error.status === 422) {
        return Response.json(
          { error: 'Email already in use' },
          { status: 409 }
        );
      } else {
        return Response.json(
          { error: 'Failed to create user' },
          { status: 500 }
        );
      }
    }

    const userId = data.user?.id;
    if (!userId) {
      return Response.json(
        { error: 'User ID not found after registration' },
        { status: 500 }
      );
    }

    try {
      await usersRepo.create({
        id: userId,
        email,
        firstName,
        lastName,
        graduationYear,
      });
      return Response.json(
        { message: 'User registered successfully' },
        { status: 201 }
      );
    } catch (err) {
      console.error('Error creating user in database:', err);
      return Response.json(
        { error: 'Failed to create user in database' },
        { status: 500 }
      );
    }
  };
}
