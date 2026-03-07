import { BrowserRouter, Route, Routes } from 'react-router';
import { AdminLayout } from './components/layout/AdminLayout.tsx';
import { AppLayout } from './components/layout/AppLayout.tsx';
import { DashboardLayout } from './components/layout/DashboardLayout.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { AdminAnalytics } from './pages/admin/AdminAnalytics.tsx';
import { AdminDashboard } from './pages/admin/AdminDashboard.tsx';
import { AdminProblems } from './pages/admin/AdminProblems.tsx';
import { AdminSystem } from './pages/admin/AdminSystem.tsx';
import { AdminUsers } from './pages/admin/AdminUsers.tsx';
import { AuthLayout } from './pages/auth/AuthLayout.tsx';
import { ForgotPassword } from './pages/auth/ForgotPassword.tsx';
import { Login } from './pages/auth/Login.tsx';
import { Register } from './pages/auth/Register.tsx';
import { DevGallery } from './pages/DevGallery.tsx';
import { Bookmarks } from './pages/dashboard/Bookmarks.tsx';
import { Dashboard } from './pages/dashboard/Dashboard.tsx';
import { SessionDetail } from './pages/dashboard/SessionDetail.tsx';
import { SessionHistory } from './pages/dashboard/SessionHistory.tsx';
import { InterviewRoom } from './pages/interview/InterviewRoom.tsx';
import { Landing } from './pages/Landing.tsx';
import { NotFound } from './pages/NotFound.tsx';
import { ProblemBrowser } from './pages/problems/ProblemBrowser.tsx';
import { ProblemDetail } from './pages/problems/ProblemDetail.tsx';
import { Profile } from './pages/profile/Profile.tsx';
import { CreateRoom } from './pages/rooms/CreateRoom.tsx';
import { JoinRoom } from './pages/rooms/JoinRoom.tsx';
import { RoomBrowser } from './pages/rooms/RoomBrowser.tsx';

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          {/* Landing — no layout */}
          <Route path="/" element={<Landing />} />

          {/* Auth routes — standalone layout, no NavBar */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
          </Route>

          {/* All other routes — wrapped in AppLayout */}
          <Route element={<AppLayout />}>
            {/* Dashboard — nested in DashboardLayout */}
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="history" element={<SessionHistory />} />
              <Route path="history/:id" element={<SessionDetail />} />
              <Route path="bookmarks" element={<Bookmarks />} />
            </Route>

            {/* Problems */}
            <Route path="/problems" element={<ProblemBrowser />} />
            <Route path="/problems/:id" element={<ProblemDetail />} />

            {/* Rooms */}
            <Route path="/rooms" element={<RoomBrowser />} />
            <Route path="/rooms/create" element={<CreateRoom />} />
            <Route path="/rooms/join" element={<JoinRoom />} />
            <Route path="/rooms/:code" element={<InterviewRoom />} />

            {/* Profile */}
            <Route path="/profile" element={<Profile />} />

            {/* Admin — nested in AdminLayout */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="problems" element={<AdminProblems />} />
              <Route path="analytics" element={<AdminAnalytics />} />
              <Route path="system" element={<AdminSystem />} />
            </Route>

            {/* Dev gallery */}
            <Route path="/dev" element={<DevGallery />} />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
