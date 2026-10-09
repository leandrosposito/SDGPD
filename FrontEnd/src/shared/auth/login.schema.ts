import { z } from 'zod';

// ============================================================
// login.schema — validacion del formulario de login (convencion del
// proyecto: zod + react-hook-form, DECISIONES_TECNICAS.md). Solo lo que
// se puede validar sin el servidor; si el email o la contrasena son
// incorrectos lo dice el backend (401 invalid-credentials).
// ============================================================

export const loginFormSchema = z.object({
  email: z.string().trim().min(1, 'Ingresa tu email').email('El email no es valido'),
  password: z.string().min(1, 'Ingresa tu contrasena'),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;
