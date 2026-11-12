import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { Layout } from './Layout';
import { AuthPage } from './pages/Auth';
import { Home } from './pages/Home';
import { LearnPage } from './pages/Learn';
import { PracticePage } from './pages/Practice';
import { ProgressPage } from './pages/Progress';
import { ResultsPage } from './pages/Results';
import { SubjectPage } from './pages/Subject';
import { Subjects } from './pages/Subjects';
import { TopicPage } from './pages/Topic';
import { AuthProvider } from './ui';
import './styles.css';

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/signin', element: <AuthPage mode="signin" /> },
      { path: '/signup', element: <AuthPage mode="signup" /> },
      { path: '/progress', element: <ProgressPage /> },
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
