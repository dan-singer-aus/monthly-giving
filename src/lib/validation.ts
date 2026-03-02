import { z } from 'zod';

export async function validateBody<T>(
  req: Request,
  schema: z.ZodType<T>
): Promise<
  { success: false; response: Response } | { success: true; data: T }
> {
  const body: unknown = await req.json();
  const parseResult = schema.safeParse(body);
  if (!parseResult.success) {
    return {
      success: false,
      response: Response.json(
        {
          error: 'Invalid request body',
          details: z.flattenError(parseResult.error),
        },
        { status: 400 }
      ),
    };
  }
  return { success: true, data: parseResult.data };
}
