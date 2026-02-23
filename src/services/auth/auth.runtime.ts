export const auth = {
  async getSessionUserId(_req: Request) {
    // stub for now; later: verify Supabase session
    return 'user-123';
  },
};
