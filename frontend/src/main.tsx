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
import { AuthProvider, Loading } from './ui';
import 'katex/dist/katex.min.css';
import './styles.css';

// Reviewer screens (pdf.js) load only when a reviewer opens them.
const ReviewQueue = lazy(() => import('./review/Queue').then((m) => ({ default: m.ReviewQueue })));
const ReviewWorkspace = lazy(() => import('./review/Workspace').then((m) => ({ default: m.ReviewWorkspace })));
const lazyPage = (el: React.ReactNode) => <Suspense fallback={<Loading />}>{el}</Suspense>;

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/signin', element: <AuthPage mode="signin" /> },
      { path: '/signup', element: <AuthPage mode="signup" /> },
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
