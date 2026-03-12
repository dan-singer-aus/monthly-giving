import { makeRegisterHandler } from '@/src/services/auth/register.handler';
import { usersRepo } from '@/src/repos/users.repo';
import { supabase } from '@/src/lib/supabaseClient';

export const POST = makeRegisterHandler({ usersRepo, supabase });
