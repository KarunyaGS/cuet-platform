import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { Layout } from './Layout';
import { AuthPage } from './pages/Auth';
import { BookmarksPage } from './pages/Bookmarks';
import { DecksPage } from './pages/Decks';
import { SheetPage } from './pages/Sheet';
import { VisualPage } from './pages/Visual';
import { FlashcardReviewPage, OldFlashcardsLink } from './pages/Flashcards';
import { UpdatesPage } from './pages/Updates';
import { PyqPage, PyqViewerPage } from './pages/Pyq';
import { DashboardPage } from './pages/Dashboard';
import { Home } from './pages/Home';
import { ExamInfo, InfoHub } from './pages/info/InfoPages';
import { PublicLayout } from './pages/info/shared';
import { LearnPage } from './pages/Learn';
import { PastPaperPage, PastPapersPage } from './pages/PastPapers';
import { PlannerPage } from './pages/Planner';
import { PlansPage } from './pages/Plans';
import { ExamInstructionsPage } from './pages/ExamInstructions';
import { PracticePage } from './pages/Practice';
import { VisualsPage } from './pages/Visuals';
import { PracticeCentrePage } from './pages/PracticeCentre';
import { MockTopicPage } from './pages/MockTopic';
import { FullMockPage } from './pages/FullMock';
import { SubjectAreaPage } from './pages/SubjectArea';
import { OfficialViewerPage } from './pages/OfficialViewer';
import { ProfilePage } from './pages/Profile';
import { ProgressPage } from './pages/Progress';
import { ResultsPage } from './pages/Results';
import { ReportPage } from './pages/Report';
import { ForgotPasswordPage, ResetPasswordPage, UnsubscribePage, VerifyEmailPage } from './pages/Reset';
import { RevisePage } from './pages/Revise';
import { NotFoundPage, SearchPage } from './pages/Search';
import { SubjectPage } from './pages/SubjectHome';
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
const AdminSupport = lazy(() => import('./admin/Support').then((m) => ({ default: m.AdminSupport })));
const AdminBilling = lazy(() => import('./admin/Billing').then((m) => ({ default: m.AdminBilling })));
const AdminEmail = lazy(() => import('./admin/Email').then((m) => ({ default: m.AdminEmail })));
const AdminNotices = lazy(() => import('./admin/Notices').then((m) => ({ default: m.AdminNotices })));
const AdminAdmissions = lazy(() => import('./admin/Admissions').then((m) => ({ default: m.AdminAdmissions })));
const UniversityPage = lazy(() => import('./pages/University').then((m) => ({ default: m.UniversityPage })));
const AdmissionsPage = lazy(() => import('./pages/Admissions').then((m) => ({ default: m.AdmissionsPage })));
const ProgrammePage = lazy(() => import('./pages/Admissions').then((m) => ({ default: m.ProgrammePage })));
const AdminRegistry = lazy(() => import('./admin/Registry').then((m) => ({ default: m.AdminRegistry })));
const AdminActivity = lazy(() => import('./admin/Admin').then((m) => ({ default: m.AdminActivity })));
const ReviewLayout = lazy(() => import('./review/Home').then((m) => ({ default: m.ReviewLayout })));
const ReviewDashboard = lazy(() => import('./review/Home').then((m) => ({ default: m.ReviewDashboard })));
const ReviewBulkApproval = lazy(() => import('./review/BulkApproval').then((m) => ({ default: m.BulkApproval })));
const ReviewSampleList = lazy(() => import('./review/SampleReview').then((m) => ({ default: m.SampleReviewList })));
const ReviewSample = lazy(() => import('./review/SampleReview').then((m) => ({ default: m.SampleReviewPage })));
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
  // Mock tests run on their own screens, outside the normal app layout: the instructions, then the full-screen examination.
  { path: '/exam/start', element: <RequireAuth><ExamInstructionsPage /></RequireAuth> },
  { path: '/exam/:sessionId', element: <RequireAuth><PracticePage exam /></RequireAuth> },
  // Everything else is for signed-in students only.
  {
    element: (
      <RequireAuth>
        <Layout />
      </RequireAuth>
    ),
    children: [
      { path: '/', element: <Home /> },
      { path: '/dashboard', element: <Navigate to="/" replace /> },
      { path: '/planner', element: <PlannerPage /> },
      { path: '/bookmarks', element: <BookmarksPage /> },
      // Visual learning prototype: one Physics topic.
      { path: '/visual/gravitation', element: <VisualPage /> },
      { path: '/updates', element: <UpdatesPage /> },
      { path: '/universities/:slug', element: lazyPage(<UniversityPage />) },
      { path: '/admissions', element: lazyPage(<AdmissionsPage />) },
      { path: '/admissions/programmes/:id', element: lazyPage(<ProgrammePage />) },
      { path: '/pyq', element: <PyqPage /> },
      { path: '/pyq/view/:id', element: <PyqViewerPage /> },
      { path: '/bookmarks/decks', element: <DecksPage /> },
      { path: '/sheets/chapter/:nodeId', element: <SheetPage mode="chapter" /> },
      { path: '/sheets/subject/:paperId', element: <SheetPage mode="subject" /> },
      { path: '/sheets/weak', element: <SheetPage mode="weak" /> },
      { path: '/bookmarks/review', element: <FlashcardReviewPage /> },
      // Old addresses: flashcards are part of My bookmarks now.
      { path: '/flashcards', element: <OldFlashcardsLink to="/bookmarks" /> },
      { path: '/flashcards/review', element: <OldFlashcardsLink to="/bookmarks/review" /> },
      { path: '/profile', element: <ProfilePage /> },
      { path: '/progress', element: <ProgressPage /> },
      { path: '/search', element: <SearchPage /> },
      { path: '/report', element: <ReportPage /> },
      { path: '/plans', element: <PlansPage /> },
      { path: '/practice-centre', element: <PracticeCentrePage /> },
      { path: '/mock-tests/topic/:nodeId', element: <MockTopicPage /> },
      { path: '/mock-tests/full/:paperId', element: <FullMockPage /> },
      { path: '/official-papers/view/:id', element: <OfficialViewerPage /> },
      { path: '/past-papers', element: <PastPapersPage /> },
      { path: '/past-papers/:id', element: <PastPaperPage /> },
      { path: '/revise/:nodeId', element: <RevisePage /> },
      { path: '/visuals/:nodeId', element: <VisualsPage /> },
      {
        path: '/review',
        element: lazyPage(<ReviewLayout />),
        children: [
          { index: true, element: lazyPage(<ReviewDashboard />) },
          { path: 'syllabus', element: lazyPage(<ReviewQueue />) },
          { path: 'content', element: lazyPage(<ReviewContent />) },
          { path: 'bulk-approval', element: lazyPage(<ReviewBulkApproval />) },
          { path: 'sample', element: lazyPage(<ReviewSampleList />) },
          { path: 'sample/:id', element: lazyPage(<ReviewSample />) },
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
          { path: 'support', element: lazyPage(<AdminSupport />) },
          { path: 'email', element: lazyPage(<AdminEmail />) },
          { path: 'updates', element: lazyPage(<AdminNotices />) },
          { path: 'admissions', element: lazyPage(<AdminAdmissions />) },
          { path: 'registry', element: lazyPage(<AdminRegistry />) },
          { path: 'activity', element: lazyPage(<AdminActivity />) },
        ],
      },
      { path: '/topic/:nodeId', element: <TopicPage /> },
      { path: '/learn/:resourceId', element: <LearnPage /> },
      { path: '/practice/:sessionId', element: <PracticePage /> },
      { path: '/results/:sessionId', element: <ResultsPage /> },
      { path: '/:exam', element: <Subjects /> },
      { path: '/:exam/subject/:paperId', element: <SubjectPage /> },
      { path: '/:exam/subject/:paperId/:area', element: <SubjectAreaPage /> },
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
