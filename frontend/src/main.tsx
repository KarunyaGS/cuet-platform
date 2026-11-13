import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { Layout } from './Layout';
import { AuthPage } from './pages/Auth';
import { BookmarksPage } from './pages/Bookmarks';
import { DashboardPage } from './pages/Dashboard';
import { Home } from './pages/Home';
import { ExamInfo, InfoHub } from './pages/info/InfoPages';
import { PublicLayout } from './pages/info/shared';
import { LearnPage } from './pages/Learn';
import { PastPaperPage, PastPapersPage } from './pages/PastPapers';
import { PlannerPage } from './pages/Planner';
import { PlansPage } from './pages/Plans';
import { PracticePage } from './pages/Practice';
import { PracticeCentrePage } from './pages/PracticeCentre';
import { OfficialViewerPage } from './pages/OfficialViewer';
import { ProfilePage } from './pages/Profile';
import { ProgressPage } from './pages/Progress';
import { ResultsPage } from './pages/Results';
import { ReportPage } from './pages/Report';
import { ForgotPasswordPage, ResetPasswordPage, UnsubscribePage, VerifyEmailPage } from './pages/Reset';
import { RevisePage } from './pages/Revise';
import { NotFoundPage, SearchPage } from './pages/Search';
import { SubjectPage } from './pages/Subject';
import { Subjects } from './pages/Subjects';
import { TopicPage } from './pages/Topic';
import { AuthProvider, GuestOnly, Loading, RequireAuth } from './ui';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans-devanagari/400.css';
import '@fontsource/ibm-plex-sans-devanagari/600.css';
import '@fontsource/ibm-plex-serif/400.css';
import '@fontsource/ibm-plex-serif/400-italic.css';
import '@fontsource/ibm-plex-serif/600.css';
import 'katex/dist/katex.min.css';
import './styles.css';

// Reviewer screens (pdf.js) load only when a reviewer opens them.
const ReviewQueue = lazy(() => import('./review/Queue').then((m) => ({ default: m.ReviewQueue })));
const ReviewWorkspace = lazy(() => import('./review/Workspace').then((m) => ({ default: m.ReviewWorkspace })));
const AdminLayout = lazy(() => import('./admin/Admin').then((m) => ({ default: m.AdminLayout })));
const AdminOverview = lazy(() => import('./admin/Admin').then((m) => ({ default: m.AdminOverview })));
const AdminStudents = lazy(() => import('./admin/Admin').then((m) => ({ default: m.AdminStudents })));
const AdminStudent = lazy(() => import('./admin/Admin').then((m) => ({ default: m.AdminStudent })));
const AdminContent = lazy(() => import('./admin/Admin').then((m) => ({ default: m.AdminContent })));
const AdminCompletion = lazy(() => import('./admin/Admin').then((m) => ({ default: m.AdminCompletion })));
const AdminStaff = lazy(() => import('./admin/Admin').then((m) => ({ default: m.AdminStaff })));
const AdminPracticeCentre = lazy(() => import('./admin/PracticeCentre').then((m) => ({ default: m.AdminPracticeCentre })));
const AdminPastPapers = lazy(() => import('./admin/PastPapers').then((m) => ({ default: m.AdminPastPapers })));
const AdminBilling = lazy(() => import('./admin/Billing').then((m) => ({ default: m.AdminBilling })));
const AdminEmail = lazy(() => import('./admin/Email').then((m) => ({ default: m.AdminEmail })));
const AdminActivity = lazy(() => import('./admin/Admin').then((m) => ({ default: m.AdminActivity })));
const ReviewLayout = lazy(() => import('./review/Home').then((m) => ({ default: m.ReviewLayout })));
const ReviewDashboard = lazy(() => import('./review/Home').then((m) => ({ default: m.ReviewDashboard })));
const ReviewContent = lazy(() => import('./review/Home').then((m) => ({ default: m.ReviewContent })));
const lazyPage = (el: React.ReactNode) => <Suspense fallback={<Loading />}>{el}</Suspense>;

const router = createBrowserRouter([
  // Visitors see the welcome / sign-in page first; signed-in students are sent on to the app.
  { path: '/signin', element: <GuestOnly><AuthPage mode="signin" /></GuestOnly> },
  { path: '/signup', element: <GuestOnly><AuthPage mode="signup" /></GuestOnly> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/verify-email', element: <VerifyEmailPage /> },
  { path: '/unsubscribe', element: <UnsubscribePage /> },
  // Official exam information: public, no sign-in needed.
  {
    element: <PublicLayout />,
    children: [
      { path: '/cuet', element: <InfoHub /> },
      { path: '/cuet/:exam', element: <ExamInfo /> },
      { path: '/cuet/:exam/:page', element: <ExamInfo /> },
    ],
  },
  // Everything else is for signed-in students only.
  {
    element: (
      <RequireAuth>
        <Layout />
      </RequireAuth>
    ),
    children: [
      { path: '/', element: <Home /> },
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/planner', element: <PlannerPage /> },
      { path: '/bookmarks', element: <BookmarksPage /> },
      { path: '/profile', element: <ProfilePage /> },
      { path: '/progress', element: <ProgressPage /> },
      { path: '/search', element: <SearchPage /> },
      { path: '/report', element: <ReportPage /> },
      { path: '/plans', element: <PlansPage /> },
      { path: '/practice-centre', element: <PracticeCentrePage /> },
      { path: '/official-papers/view/:id', element: <OfficialViewerPage /> },
      { path: '/past-papers', element: <PastPapersPage /> },
      { path: '/past-papers/:id', element: <PastPaperPage /> },
      { path: '/revise/:nodeId', element: <RevisePage /> },
      {
        path: '/review',
        element: lazyPage(<ReviewLayout />),
        children: [
          { index: true, element: lazyPage(<ReviewDashboard />) },
          { path: 'syllabus', element: lazyPage(<ReviewQueue />) },
          { path: 'content', element: lazyPage(<ReviewContent />) },
        ],
      },
      { path: '/review/paper/:paperId', element: lazyPage(<ReviewWorkspace />) },
      {
        path: '/admin',
        element: lazyPage(<AdminLayout />),
        children: [
          { index: true, element: lazyPage(<AdminOverview />) },
          { path: 'students', element: lazyPage(<AdminStudents />) },
          { path: 'students/:id', element: lazyPage(<AdminStudent />) },
          { path: 'content', element: lazyPage(<AdminContent />) },
          { path: 'completion', element: lazyPage(<AdminCompletion />) },
          { path: 'staff', element: lazyPage(<AdminStaff />) },
          { path: 'practice-centre', element: lazyPage(<AdminPracticeCentre />) },
          { path: 'past-papers', element: lazyPage(<AdminPastPapers />) },
          { path: 'billing', element: lazyPage(<AdminBilling />) },
          { path: 'email', element: lazyPage(<AdminEmail />) },
          { path: 'activity', element: lazyPage(<AdminActivity />) },
        ],
      },
      { path: '/topic/:nodeId', element: <TopicPage /> },
      { path: '/learn/:resourceId', element: <LearnPage /> },
      { path: '/practice/:sessionId', element: <PracticePage /> },
      { path: '/results/:sessionId', element: <ResultsPage /> },
      { path: '/:exam', element: <Subjects /> },
      { path: '/:exam/subject/:paperId', element: <SubjectPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
);
