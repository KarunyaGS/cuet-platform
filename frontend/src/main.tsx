import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { Layout } from './Layout';
import { AuthPage } from './pages/Auth';
import { BookmarksPage } from './pages/Bookmarks';
import { DashboardPage } from './pages/Dashboard';
import { Home } from './pages/Home';
import { LearnPage } from './pages/Learn';
import { PlannerPage } from './pages/Planner';
import { PracticePage } from './pages/Practice';
import { ProfilePage } from './pages/Profile';
import { ProgressPage } from './pages/Progress';
import { ResultsPage } from './pages/Results';
import { RevisePage } from './pages/Revise';
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
const lazyPage = (el: React.ReactNode) => <Suspense fallback={<Loading />}>{el}</Suspense>;

const router = createBrowserRouter([
  // Visitors see the welcome / sign-in page first; signed-in students are sent on to the app.
  { path: '/signin', element: <GuestOnly><AuthPage mode="signin" /></GuestOnly> },
  { path: '/signup', element: <GuestOnly><AuthPage mode="signup" /></GuestOnly> },
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
      { path: '/revise/:nodeId', element: <RevisePage /> },
      { path: '/review', element: lazyPage(<ReviewQueue />) },
      { path: '/review/paper/:paperId', element: lazyPage(<ReviewWorkspace />) },
      { path: '/topic/:nodeId', element: <TopicPage /> },
      { path: '/learn/:resourceId', element: <LearnPage /> },
      { path: '/practice/:sessionId', element: <PracticePage /> },
      { path: '/results/:sessionId', element: <ResultsPage /> },
      { path: '/:exam', element: <Subjects /> },
      { path: '/:exam/subject/:paperId', element: <SubjectPage /> },
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
