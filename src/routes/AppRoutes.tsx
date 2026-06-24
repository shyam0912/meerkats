import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "../pages/Home/Home";
import ClassSelection from "../pages/ClassSelection/ClassSelection";
import SubjectSelection from "../pages/SubjectSelection/SubjectSelection";
import Workspace from "../pages/Workspace/Workspace";

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/classes" element={<ClassSelection />} />
        <Route path="/subjects" element={<SubjectSelection />} />
        <Route path="/workspace" element={<Workspace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;