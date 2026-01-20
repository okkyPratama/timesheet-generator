'use client';

import { UserDataProvider } from '@/context/UserDataContext';
import { PdfCartProvider } from '@/context/PdfCartContext';

export default function Providers({ children }) {
  return (
    <UserDataProvider>
      <PdfCartProvider>
        {children}
      </PdfCartProvider>
    </UserDataProvider>
  );
}
