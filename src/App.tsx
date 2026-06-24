import AppRoutes from "./routes/AppRoutes";
import { ClassroomProvider } from "./store/classroomProvider";

function App() {
  return (
    <ClassroomProvider>
      <AppRoutes />
    </ClassroomProvider>
  );
}

export default App;