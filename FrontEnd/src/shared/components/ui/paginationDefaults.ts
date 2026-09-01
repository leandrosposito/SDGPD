// ============================================================
// Opciones de tamaño de pagina para Pagination.tsx. Separado de ese
// archivo porque un componente solo puede exportar componentes
// (react-refresh/only-export-components) — mismo criterio que
// deliveryStatusLabels.ts separado de DeliveriesTable.tsx.
// ============================================================

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
