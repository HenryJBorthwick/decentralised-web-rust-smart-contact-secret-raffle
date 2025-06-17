import type { FC, ReactNode } from 'react';
import WalletButton from './WalletButton';
import ToastContainer from './shared/ToastContainer';
import { useToast } from '../hooks/useToast';

interface LayoutProps {
  children: ReactNode;
}

const Layout: FC<LayoutProps> = ({ children }) => {
  const { toasts, removeToast } = useToast();

  // Convert toasts to the format expected by ToastContainer
  const toastContainerToasts = toasts.map(toast => ({
    ...toast,
    onClose: () => removeToast(toast.id)
  }));

  return (
    <div className="min-h-screen flex flex-col font-sans bg-gray-100">
      <header className="bg-primary text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">Secret Raffle dApp</h1>
            </div>
            <WalletButton />
          </div>
        </div>
      </header>
      
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      
      <footer className="bg-gray-200 border-t border-gray-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-gray-600">
            Built for COSC473
          </p>
        </div>
      </footer>
      
      <ToastContainer toasts={toastContainerToasts} onRemoveToast={removeToast} />
    </div>
  );
};

export default Layout; 