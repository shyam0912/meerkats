import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "../pages/Home/Home";
import ClassSelection from "../pages/ClassSelection/ClassSelection";
import SubjectSelection from "../pages/SubjectSelection/SubjectSelection";
import Workspace from "../pages/Workspace/Workspace";
import { lazy, Suspense } from 'react';
const Catalog = lazy(() => import('../pages/Catalog/Catalog'));

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/classes" element={<ClassSelection />} />
        <Route path="/catalog" element={<Suspense fallback={<main role="status">Loading catalog…</main>}><Catalog /></Suspense>} />
        <Route path="/subjects" element={<SubjectSelection />} />
        <Route path="/workspace" element={<Workspace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;
