import AppRoutes from "./routes/AppRoutes";
import AppProviders from "./providers/AppProviders";

function App() {
  return (
    <AppProviders>
      <AppRoutes />
    </AppProviders>
  );
}

export default App;