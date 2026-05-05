import { z, type ZodSchema } from 'zod';
import { NextResponse } from 'next/server';

type ValidationOk<T>   = { ok: true;  data: T };
type ValidationFail    = { ok: false; response: NextResponse };
type ValidationResult<T> = ValidationOk<T> | ValidationFail;

// Valida el body d'una NextRequest contra un schema Zod.
// Retorna { ok: true, data } o { ok: false, response } (llest per retornar a la route).
export async function validateBody<T>(
  req: Request,
  schema: ZodSchema<T>
): Promise<ValidationResult<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Body ha de ser JSON vàlid.' }, { status: 400 }),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const errors = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
    return {
      ok: false,
      response: NextResponse.json({ error: 'Validació fallida.', details: errors }, { status: 422 }),
    };
  }

  return { ok: true, data: result.data };
}

// Versió síncrona per validar dades ja parseades (útil per a query params, etc.)
export function validateData<T>(
  data: unknown,
  schema: ZodSchema<T>
): ValidationResult<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
    return {
      ok: false,
      response: NextResponse.json({ error: 'Validació fallida.', details: errors }, { status: 422 }),
    };
  }
  return { ok: true, data: result.data };
}
