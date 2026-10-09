import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@sdgpd/contracts';
import { z } from 'zod';

// ============================================================
// userForm.schema — formulario de alta y edicion de usuario (BE-1b).
// Las reglas son las del contrato (createUserRequestSchema /
// updateUserRequestSchema de @sdgpd/contracts); aca se repiten las que la UI
// puede mostrar antes de mandar, con mensajes en castellano. El backend
// valida igual.
// ============================================================

const base = {
  fullName: z.string().trim().min(1, 'Ingresa el nombre').max(200, 'Maximo 200 caracteres'),
  roleId: z.string().min(1, 'Elegi un rol'),
  active: z.boolean(),
  branchIds: z.array(z.string()),
};

export const createUserFormSchema = z.object({
  ...base,
  email: z.string().trim().min(1, 'Ingresa el email').email('El email no es valido'),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Al menos ${PASSWORD_MIN_LENGTH} caracteres`)
    .max(PASSWORD_MAX_LENGTH, `Maximo ${PASSWORD_MAX_LENGTH} caracteres`),
});

export const editUserFormSchema = z.object({ ...base, email: z.string(), password: z.string() });

export type UserFormValues = z.infer<typeof createUserFormSchema>;
