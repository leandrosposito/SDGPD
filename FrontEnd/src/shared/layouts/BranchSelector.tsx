import { useEffect, useRef, useState, type FC, type KeyboardEvent } from 'react';
import { Building2, Check, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useSessionStore } from '@/shared/state/useSessionStore';
import { SkeletonLoader } from '@/shared/components/ui/SkeletonLoader';
import './BranchSelector.css';

// ============================================================
// BranchSelector — Empresa activa (solo lectura) + sucursal activa
// (elegible). Dropdown propio con soporte basico de teclado/ARIA:
// aria-haspopup + aria-expanded en el trigger, role="listbox"/"option"
// en el menu, cierre con Escape o click afuera.
// ============================================================

export const BranchSelector: FC = () => {
  const session = useSessionStore((s) => s.session);
  const activeBranchId = useSessionStore((s) => s.activeBranchId);
  const isLoading = useSessionStore((s) => s.isLoading);
  const setActiveBranch = useSessionStore((s) => s.setActiveBranch);

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Sesion todavia no cargada: placeholder del mismo tamano para que
  // el header no salte de layout cuando la sesion llegue.
  if (isLoading || !session || !activeBranchId) {
    return (
      <div className="branch-selector branch-selector--loading">
        <SkeletonLoader width="11rem" height="2.25rem" borderRadius="var(--radius-md)" />
      </div>
    );
  }

  const activeBranch = session.branches.find((b) => b.id === activeBranchId);

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' && !isOpen) {
      event.preventDefault();
      setIsOpen(true);
    }
  }

  function handleSelect(branchId: string, branchName: string) {
    setIsOpen(false);
    triggerRef.current?.focus();

    if (branchId === activeBranchId) return;

    const result = setActiveBranch(branchId);

    if (result.success) {
      toast.success(`Sucursal activa: ${branchName}.`);
      return;
    }

    const message =
      result.reason === 'inactive'
        ? 'Esa sucursal esta inactiva y no se puede seleccionar.'
        : 'No se encontro la sucursal.';
    toast.error(message);
  }

  return (
    <div className="branch-selector" ref={containerRef}>
      <button
        type="button"
        ref={triggerRef}
        className="branch-selector__trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Sucursal activa: ${activeBranch?.name ?? 'sin definir'}. Abrir selector de sucursal.`}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleTriggerKeyDown}
      >
        <Building2 size={16} aria-hidden="true" className="branch-selector__icon" />
        <span className="branch-selector__text">
          <span className="branch-selector__company">{session.company.name}</span>
          <span className="branch-selector__branch">{activeBranch?.name ?? 'Sucursal'}</span>
        </span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`branch-selector__chevron${isOpen ? ' branch-selector__chevron--open' : ''}`}
        />
      </button>

      {isOpen && (
        <ul className="branch-selector__menu" role="listbox" aria-label="Elegir sucursal activa">
          {session.branches.map((branch) => {
            const isActive = branch.id === activeBranchId;
            const isDisabled = branch.status !== 'active';

            return (
              <li key={branch.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  disabled={isDisabled}
                  className={`branch-selector__option${isActive ? ' branch-selector__option--active' : ''}`}
                  onClick={() => handleSelect(branch.id, branch.name)}
                >
                  <span className="branch-selector__option-info">
                    <span className="branch-selector__option-name">
                      {branch.name}
                      {isDisabled && (
                        <span className="branch-selector__option-tag"> (inactiva)</span>
                      )}
                    </span>
                    <span className="branch-selector__option-city">{branch.city}</span>
                  </span>
                  {isActive && (
                    <Check size={14} aria-hidden="true" className="branch-selector__check" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
