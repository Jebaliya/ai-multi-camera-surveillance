import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import LiveCamera from "./pages/LiveCamera";
import LiveMonitoring from "./pages/LiveMonitoring";
import AttendanceLog from "./pages/AttendanceLog";
import RegisterPeople from "./pages/RegisterPeople";
import UserManagement from "./pages/UserManagement";
import CameraManagement from "./pages/CameraManagement";
import PersonActivity from "./pages/PersonActivity";
import Alerts from "./pages/Alerts";
import { ToastProvider } from "./components/ToastContext";
import { ConfirmProvider } from "./components/ConfirmContext";

export default function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="cameras" element={<CameraManagement />} />
              <Route path="live" element={<LiveMonitoring />} />
              <Route path="activity" element={<PersonActivity />} />
              <Route path="alerts" element={<Alerts />} />
              <Route path="legacy-live" element={<LiveCamera />} />
              <Route path="register" element={<RegisterPeople />} />
              <Route path="log" element={<AttendanceLog />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ConfirmProvider>
    </ToastProvider>
  );
}





