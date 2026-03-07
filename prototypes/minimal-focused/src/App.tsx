import { BrowserRouter, Route, Routes } from 'react-router';
import { Toaster } from 'sonner';
import { AdminLayout } from './components/layout/AdminLayout';
import { AppLayout } from './components/layout/AppLayout';
import { NavOnlyLayout } from './components/layout/NavOnlyLayout';
import { ThemeProvider } from './context/ThemeContext';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminProblems } from './pages/admin/AdminProblems';
import { AdminSystem } from './pages/admin/AdminSystem';
import { AdminUsers } from './pages/admin/AdminUsers';
import { ForgotPassword } from './pages/auth/ForgotPassword';
import { Login } from './pages/auth/Login';
import { Register } from './pages/auth/Register';
import { DevGallery } from './pages/DevGallery';
import { Dashboard } from './pages/dashboard/Dashboard';
import { SessionDetail } from './pages/dashboard/SessionDetail';
import { Sessions } from './pages/dashboard/Sessions';
import { InterviewRoom } from './pages/interview/InterviewRoom';
import { Landing } from './pages/Landing';
import { NotFound } from './pages/NotFound';
import { Placeholder } from './pages/Placeholder';
import { ProblemBrowser } from './pages/problems/ProblemBrowser';
import { ProblemDetail } from './pages/problems/ProblemDetail';
import { Profile } from './pages/profile/Profile';
import { Settings } from './pages/profile/Settings';
import { JoinRoom } from './pages/rooms/JoinRoom';
import { Lobby } from './pages/rooms/Lobby';
import { RoomBrowser } from './pages/rooms/RoomBrowser';

function App() {
  return (
    <ThemeProvider>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--bg-raised)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
          },
        }}
      />
      <BrowserRouter>
        <Routes>
          {/* Dev Gallery — standalone, no layout */}
          <Route path="/dev" element={<DevGallery />} />

          {/* Routes WITHOUT AppLayout */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/rooms/:code/session" element={<InterviewRoom />} />

          {/* Routes WITH AppLayout */}
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/sessions" element={<Sessions />} />
            <Route path="/dashboard/sessions/:id" element={<SessionDetail />} />
            <Route path="/rooms" element={<RoomBrowser />} />
            <Route path="/rooms/join" element={<JoinRoom />} />
            <Route path="/rooms/:code/lobby" element={<Lobby />} />
            <Route path="/problems" element={<ProblemBrowser />} />
            <Route path="/problems/:id" element={<ProblemDetail />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/settings" element={<Settings />} />
          </Route>

          {/* Admin routes: TopNav visible, but no padded main wrapper */}
          <Route element={<NavOnlyLayout />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="problems" element={<AdminProblems />} />
              <Route path="system" element={<AdminSystem />} />
            </Route>
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
