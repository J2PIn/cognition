import { Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing";
import SignIn from "./pages/SignIn";
import AppHome from "./pages/AppHome";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/app" element={<AppHome />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
