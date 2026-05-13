'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { clearTokens } from '@/lib/auth';

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    clearTokens();
    router.push('/auth/login');
  }, [router]);

  return React.createElement(
    'main',
    { className: 'mx-auto max-w-md p-6' },
    React.createElement(
      'div',
      {
        className:
          'rounded-xl border-4 border-black bg-white p-6 text-center shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]',
      },
      'LOGGING OUT…'
    )
  );
}
