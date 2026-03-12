import { supabase } from '@/src/lib/supabaseClient';
import type { Auth } from '@/src/lib/auth';

function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice('Bearer '.length);
}

export const auth: Auth = {
  async getSessionUserId(req: Request): Promise<string | null> {
    const token = extractBearerToken(req);
    if (!token) return null;

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;

    return data.user.id;
  },
};
