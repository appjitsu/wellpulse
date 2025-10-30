/**
 * Toast notification hook
 * Simple toast implementation for admin portal
 */

import { useState, useCallback } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';
type ToastVariant = 'default' | 'destructive';

interface Toast {
  id: string;
  title: string;
  description?: string;
  type: ToastType;
  variant?: ToastVariant;
}

interface ToastOptions {
  title: string;
  description?: string;
  type?: ToastType;
  variant?: ToastVariant;
}

let toastCount = 0;

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((options: ToastOptions) => {
    const id = `toast-${toastCount++}`;
    const newToast: Toast = {
      id,
      title: options.title,
      description: options.description,
      type: options.type || 'info',
      variant: options.variant,
    };

    setToasts((prev) => [...prev, newToast]);

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);

    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return {
    toast,
    toasts,
    dismiss,
  };
}
