import { Toaster } from 'sonner';
import { AppRoutes } from './shared/routes/AppRoutes';

// ============================================================
// App — Root component, entry point
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
