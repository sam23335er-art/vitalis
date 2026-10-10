import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, ToastProvider } from './context.jsx';
import { LangProvider } from './i18n.jsx';
import Landing from './pages/Landing.jsx';
import { Spinner } from './app/ui.jsx';
// Шрифты встроены в сайт — не зависят от Google и работают без интернета
import '@fontsource/oswald/500.css';
import '@fontsource/oswald/600.css';
import '@fontsource/oswald/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import './styles.css';
import './app.css';

// Страницы кабинета грузятся по требованию — лендинг остаётся лёгким
const AuthPage = lazy(() => import('./pages/AuthPage.jsx'));
const AppLayout = lazy(() => import('./app/AppLayout.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const Nutrition = lazy(() => import('./pages/Nutrition.jsx'));
const Training = lazy(() => import('./pages/Training.jsx'));
const Coach = lazy(() => import('./pages/Coach.jsx'));
const Labs = lazy(() => import('./pages/Labs.jsx'));
const Assistant = lazy(() => import('./pages/Assistant.jsx'));
const Guide = lazy(() => import('./pages/Guide.jsx'));
const Admin = lazy(() => import('./pages/Admin.jsx'));
const Teach = lazy(() => import('./pages/Teach.jsx'));
const PublicGuide = lazy(() => import('./pages/PublicGuide.jsx'));

const Fallback = () => (
  <div className="page-loading">
    <Spinner />
  </div>
);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <LangProvider>
          <Suspense fallback={<Fallback />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<AuthPage mode="login" />} />
              <Route path="/register" element={<AuthPage mode="register" />} />
              <Route path="/guide" element={<PublicGuide />} />
              <Route path="/app" element={<AppLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="profile" element={<Profile />} />
                <Route path="nutrition" element={<Nutrition />} />
                <Route path="training" element={<Training />} />
                <Route path="coach" element={<Coach />} />
                <Route path="labs" element={<Labs />} />
                <Route path="assistant" element={<Assistant />} />
                <Route path="guide" element={<Guide />} />
                <Route path="admin" element={<Admin />} />
                <Route path="teach" element={<Teach />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          </LangProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
