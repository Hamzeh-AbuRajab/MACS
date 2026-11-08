import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthContext';
import { RequireAuth, RequirePerm } from '@/auth/guards';
import { ToastProvider } from '@/components/kit';
import { Ranks } from '@/modules/Ranks';
import { DepartmentDetail, Departments } from '@/modules/Departments';
import { PersonnelDetail, PersonnelList } from '@/modules/Personnel';
import { Laws } from '@/modules/Laws';
import { Decisions } from '@/modules/Decisions';
import { Announcements } from '@/modules/Announcements';
import { Requests } from '@/modules/Requests';
import { AdminHub } from '@/modules/admin/AdminHub';
import { Warehouses } from '@/modules/Warehouses';
import { FileReport, Intelligence } from '@/modules/Intelligence';
import { Discipline } from '@/modules/Discipline';
import { Command } from '@/modules/Command';
import { AppLayout } from '@/app/AppLayout';
import { Dashboard } from '@/app/Dashboard';
import { Notifications } from '@/app/Notifications';
import { Profile } from '@/app/Profile';
import { Landing } from '@/pages/Landing';
import { Login } from '@/pages/Login';
import { ForgotPassword } from '@/pages/ForgotPassword';

const NotFound = () => (
  <div className="grid min-h-[60vh] place-items-center text-center">
    <div>
      <p className="ltr font-mono text-5xl font-bold text-gold-500">404</p>
      <p className="mt-3 text-slate-300">الصفحة غير موجودة</p>
      <Link to="/" className="btn btn-outline mt-5">الصفحة الرئيسية</Link>
    </div>
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/app" element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="profile" element={<Profile />} />
              <Route path="command" element={<RequirePerm perm="reports.view"><Command /></RequirePerm>} />
              <Route path="personnel" element={<RequirePerm perm="personnel.view"><PersonnelList /></RequirePerm>} />
              <Route path="personnel/:userId" element={<PersonnelDetail />} />
              <Route path="ranks" element={<Ranks />} />
              <Route path="departments" element={<Departments />} />
              <Route path="departments/:id" element={<DepartmentDetail />} />
              <Route path="laws" element={<Laws />} />
              <Route path="decisions" element={<Decisions />} />
              <Route path="announcements" element={<Announcements />} />
              <Route path="requests" element={<Requests />} />
              <Route path="report" element={<FileReport />} />
              <Route path="warehouses" element={<RequirePerm perm="warehouses.view"><Warehouses /></RequirePerm>} />
              <Route path="intelligence" element={<RequirePerm perm="cases.view"><Intelligence /></RequirePerm>} />
              <Route path="discipline" element={<RequirePerm perm="discipline.view"><Discipline /></RequirePerm>} />
              <Route path="admin" element={<AdminHub />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
