import React, { ReactNode } from 'react';
import { ToastProvider } from '@/components/ui/toast';

interface AppProviderProps {
  children: ReactNode;
}

/**
 * Fablr Design System
 * Theme tokens are in globals.css CSS variables
 * Dark mode is handled via Tailwind .dark class on <html>
 */

/**
 * 应用根Provider组件
 * 包含所有需要的Context Provider
 * Dark mode 通过 Tailwind .dark class on <html> 由 ThemeProvider 处理
 */

const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  return (
    <ToastProvider>
      {children}
    </ToastProvider>
  );
};

export default AppProvider;
