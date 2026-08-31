import type { ReactNode } from 'react';
import './Table.css';

// ============================================================
// Table — Reusable data table component
// ============================================================

interface Column<T> {
  header: ReactNode;
  accessor: keyof T | ((row: T) => ReactNode);
  align?: 'left' | 'center' | 'right';
  width?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string | number;
  emptyMessage?: string;
  rowClassName?: (row: T) => string;
}

export function Table<T>({ columns, data, keyExtractor, emptyMessage = 'No hay datos disponibles', rowClassName }: TableProps<T>) {
  if (!data.length) {
    return <div className="table-empty">{emptyMessage}</div>;
  }

  return (
    <div className="table-container">
      <table className="table" aria-label="Tabla de datos">
        <thead>
          <tr>
            {columns.map((col, index) => (
              <th
                key={index}
                scope="col"
                className={`table__th table__th--${col.align || 'left'}`}
                style={{ width: col.width }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const customClass = rowClassName ? rowClassName(row) : '';
            return (
              <tr key={keyExtractor(row)} className={`table__row ${customClass}`.trim()}>
                {columns.map((col, colIndex) => {
                const cellContent =
                  typeof col.accessor === 'function'
                    ? col.accessor(row)
                    : (row[col.accessor] as ReactNode);

                return (
                  <td
                    key={colIndex}
                    className={`table__td table__td--${col.align || 'left'}`}
                  >
                    {cellContent}
                  </td>
                );
              })}
            </tr>
          );
          })}
        </tbody>
      </table>
    </div>
  );
}
