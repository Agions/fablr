import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, HashRouter, Navigate } from 'react-router-dom';

import ErrorBoundary from './components/common/error-boundary';
const loadAppProvider = () => import('./providers/app-provider');
const loadLayout = () => import('./components/layout/layout');
const AppProvider = lazy(loadAppProvider);
const Layout = lazy(loadLayout);

// 懒加载页面组件 - 优化首屏加载
const loadHome = () => import('./pages/home/index');
const loadProjects = () => import('./pages/projects/index');
const loadProjectEdit = () => import('./pages/project-edit/index');
const loadProjectDetail = () => import('./pages/project-detail/index');
const loadScriptDetail = () => import('./pages/script-detail/index');
const loadSettings = () => import('./pages/settings/index');
const loadUnderstanding = () => import('./features/understanding/understanding-page');
const loadScriptStudio = () => import('./pages/script-studio/index');
const loadAssetHub = () => import('./pages/asset-hub/index');
const loadExportHub = () => import('./pages/export-hub/index');
const Home = lazy(loadHome);
const Projects = lazy(loadProjects);
const ProjectEdit = lazy(loadProjectEdit);
const ProjectDetail = lazy(loadProjectDetail);
const ScriptDetail = lazy(loadScriptDetail);
const ScriptStudio = lazy(loadScriptStudio);
const AssetHub = lazy(loadAssetHub);
const ExportHub = lazy(loadExportHub);
const loadWorkspace = () => import('./pages/workspace/index');
const WorkspacePage = lazy(loadWorkspace);
const Settings = lazy(loadSettings);
const Understanding = lazy(loadUnderstanding);

// 加载占位符 - 骨架屏
const PageLoader = () => (
  <div className="page-loader">
    <div className="page-loader-spinner" />
  </div>
);

const App: React.FC = () => {
  useEffect(() => {
    const warmup = () => {
      void loadProjects();
      void loadProjectEdit();
      void loadSettings();
    };

    const idleRequest = (
      window as Window & {
        requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number;
        cancelIdleCallback?: (id: number) => void;
      }
    ).requestIdleCallback;
    const idleCancel = (window as Window & { cancelIdleCallback?: (id: number) => void })
      .cancelIdleCallback;

    if (typeof idleRequest === 'function') {
      const id = idleRequest(warmup, { timeout: 1200 });
      return () => {
        if (typeof idleCancel === 'function') idleCancel(id);
      };
    }

    const timer = window.setTimeout(warmup, 500);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <AppProvider>
          <HashRouter>
            <Layout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/project/new" element={<ProjectEdit />} />
                <Route path="/project/edit/:projectId" element={<ProjectEdit />} />
                <Route path="/project/:projectId" element={<ProjectDetail />} />
                <Route path="/project/:projectId/script/:scriptId" element={<ScriptDetail />} />
                <Route path="/workspace" element={<WorkspacePage />} />
                <Route path="/workspace/:projectId" element={<WorkspacePage />} />
                <Route path="/editor" element={<WorkspacePage />} />
                <Route path="/editor/:projectId" element={<WorkspacePage />} />
                <Route path="/script-studio" element={<ScriptStudio />} />
                <Route path="/script-studio/:projectId" element={<ScriptStudio />} />
                <Route path="/asset-hub" element={<AssetHub />} />
                <Route path="/asset-hub/:projectId" element={<AssetHub />} />
                <Route path="/export-hub" element={<ExportHub />} />
                <Route path="/export-hub/:projectId" element={<ExportHub />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/understanding" element={<Understanding />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </HashRouter>
        </AppProvider>
      </Suspense>
    </ErrorBoundary>
  );
};

export default App;
