import { useState, type FC } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import type { Branch, Role, User } from '@sdgpd/contracts';
import { Modal } from '@/shared/components/ui/Modal';
import { createUser, updateUser } from '@/modules/settings/api/users-roles/users-roles.service';
import { createUserFormSchema, editUserFormSchema, type UserFormValues } from './userForm.schema';
import { isVersionConflict, settingsErrorMessage } from './settingsErrors';
import './UsersRoles.css';

// ============================================================
// UserFormModal — alta y edicion de usuario (BE-1b): nombre, rol, activo y
// sucursales habilitadas; en el alta, ademas, email y contrasena inicial.
// La edicion manda la `version` que se leyo (409 si cambio).
//
// Se monta SOLO abierto, con key = idempotencyKey (TabUsersRoles): cada
// apertura es un formulario nuevo con su propia clave de idempotencia,
// generada al abrirlo (ADR-BE-005 › Idempotencia), sin efectos que
// sincronicen estado. Un intento fallido no deja la clave en el servidor (el
// comando se revierte), asi que reintentar con la misma clave es seguro.
// ============================================================

export interface UserFormModalProps {
  mode: 'create' | 'edit';
  user?: User;
  roles: Role[];
  branches: Branch[];
  idempotencyKey: string;
  onClose: () => void;
  onSaved: (user: User) => void;
  // 409: el usuario cambio en el servidor; el padre recarga el listado.
  onConflict: () => void;
}

export const UserFormModal: FC<UserFormModalProps> = ({ mode, user, roles, branches, idempotencyKey, onClose, onSaved, onConflict }) => {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UserFormValues>({
    resolver: zodResolver(mode === 'create' ? createUserFormSchema : editUserFormSchema),
    defaultValues: {
      email: user?.email ?? '',
      password: '',
      fullName: user?.fullName ?? '',
      roleId: user?.roleId ?? roles[0]?.id ?? '',
      active: user?.active ?? true,
      branchIds: user?.branchIds ?? [],
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const saved =
        mode === 'create' || !user
          ? await createUser(
              {
                email: values.email,
                password: values.password,
                fullName: values.fullName,
                roleId: values.roleId,
                active: values.active,
                branchIds: values.branchIds,
              },
              idempotencyKey
            )
          : await updateUser(
              user.id,
              { fullName: values.fullName, roleId: values.roleId, active: values.active, branchIds: values.branchIds, version: user.version },
              idempotencyKey
            );
      toast.success(mode === 'create' ? 'Usuario creado.' : 'Usuario actualizado.');
      onSaved(saved);
    } catch (err) {
      const message = settingsErrorMessage(err, 'No se pudo guardar el usuario.');
      setServerError(message);
      toast.error(message);
      if (isVersionConflict(err)) onConflict();
    }
  });

  const footer = (
    <>
      <button type="button" className="client-modal-btn client-modal-btn--outline" onClick={onClose} disabled={isSubmitting}>
        Cancelar
      </button>
      <button type="submit" form="user-form" className="client-modal-btn client-modal-btn--primary" disabled={isSubmitting}>
        {isSubmitting ? 'Guardando...' : 'Guardar'}
      </button>
    </>
  );

  return (
    <Modal isOpen onClose={onClose} title={mode === 'create' ? 'Nuevo usuario' : `Editar usuario: ${user?.fullName ?? ''}`} footer={footer} size="md">
      <form id="user-form" className="users-form" onSubmit={onSubmit} noValidate>
        {mode === 'create' ? (
          <>
            <label className="users-form__field">
              <span className="users-form__label">Email</span>
              <input type="email" autoComplete="off" className={`users-form__input${errors.email ? ' users-form__input--error' : ''}`} {...register('email')} />
              {errors.email && <span className="users-form__error">{errors.email.message}</span>}
            </label>
            <label className="users-form__field">
              <span className="users-form__label">Contrasena inicial</span>
              <input type="password" autoComplete="new-password" className={`users-form__input${errors.password ? ' users-form__input--error' : ''}`} {...register('password')} />
              {errors.password && <span className="users-form__error">{errors.password.message}</span>}
            </label>
          </>
        ) : (
          <p className="users-form__label">Email: {user?.email} (no se edita)</p>
        )}

        <label className="users-form__field">
          <span className="users-form__label">Nombre</span>
          <input type="text" className={`users-form__input${errors.fullName ? ' users-form__input--error' : ''}`} {...register('fullName')} />
          {errors.fullName && <span className="users-form__error">{errors.fullName.message}</span>}
        </label>

        <label className="users-form__field">
          <span className="users-form__label">Rol</span>
          <select className="users-form__input" {...register('roleId')}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          {errors.roleId && <span className="users-form__error">{errors.roleId.message}</span>}
        </label>

        <label className="users-form__field" style={{ flexDirection: 'row', alignItems: 'center', gap: 'var(--space-2)' }}>
          <input type="checkbox" {...register('active')} />
          <span className="users-form__label">Activo</span>
        </label>

        <fieldset className="users-form__field" style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend className="users-form__label">Sucursales habilitadas</legend>
          {branches.length === 0 && <span className="users-form__label">No hay sucursales para asignar.</span>}
          {branches.map((b) => (
            <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <input type="checkbox" value={b.id} {...register('branchIds')} />
              <span>
                {b.name} ({b.code}){b.status === 'inactive' ? ' — inactiva' : ''}
              </span>
            </label>
          ))}
        </fieldset>

        {serverError && (
          <p className="users-form__error" role="alert">
            {serverError}
          </p>
        )}
      </form>
    </Modal>
  );
};
