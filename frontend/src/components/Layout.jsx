import { NavLink, Outlet } from "react-router-dom";
import { IconCamera, IconLog, IconRegister, IconRadar } from "./Icons";

export default function Layout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <IconRadar />
          </span>
          <div className="brand-text">
            <h1>Face Surveillance</h1>
            <p>Smart ERP Platform</p>
          </div>
        </div>

        <nav className="nav-bar">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          >
            <IconRadar />
            <span>Dashboard</span>
          </NavLink>
          <NavLink
            to="/users"
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          >
            <IconRegister />
            <span>ERP Directory</span>
          </NavLink>
          <NavLink
            to="/cameras"
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          >
            <IconCamera />
            <span>CCTV Cameras</span>
          </NavLink>
          <NavLink
            to="/live"
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          >
            <IconCamera />
            <span>Live Surveillance</span>
          </NavLink>
          <NavLink
            to="/activity"
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          >
            <IconRadar />
            <span>Activity Tracking</span>
          </NavLink>
          <NavLink
            to="/alerts"
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          >
            <IconRadar />
            <span>Smart Alerts</span>
          </NavLink>
          <NavLink
            to="/log"
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          >
            <IconLog />
            <span>Attendance &amp; Reports</span>
          </NavLink>
        </nav>




        <div className="sidebar-footer">
          <span className="status-dot online" />
          PostgreSQL Connected
        </div>
      </aside>

      <div className="content">
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
