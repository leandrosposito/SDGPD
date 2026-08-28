import { Toaster } from 'sonner';
import { AppRoutes } from './shared/routes/AppRoutes';

// ============================================================
// App — Root component, entry point
// Toaster (sonner) se monta una unica vez aca: es el canal obligatorio
// de feedback de acciones del proyecto (ver docs/DECISIONES_TECNICAS.md).
// ============================================================

function App() {
  return (
    <>
      <AppRoutes />
      <Toaster richColors position="top-right" />
    </>
  );
}

export default App;
