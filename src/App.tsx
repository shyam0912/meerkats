import AppRoutes from "./routes/AppRoutes";
import { ClassroomProvider } from "./store/ClassroomProvider";

function App() {
  return (
    <ClassroomProvider>
      <AppRoutes />
    </ClassroomProvider>
  );
}

export default App;