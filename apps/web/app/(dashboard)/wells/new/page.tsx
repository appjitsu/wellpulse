/**
 * Create Well Page
 *
 * Page for creating a new well.
 * Restricted to Admins and Managers only.
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { CreateWellForm } from '@/components/wells/create-well-form';

export default function NewWellPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // Redirect if not authorized (Operators cannot create)
  useEffect(() => {
    if (!isLoading && user && user.role === 'OPERATOR') {
      router.push('/wells');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <p>Loading...</p>
      </div>
    );
  }

  // If user is an Operator, show unauthorized message before redirect
  if (user?.role === 'OPERATOR') {
    return (
      <div className="container mx-auto py-8">
        <p>Unauthorized. Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <Button variant="ghost" asChild>
          <Link href="/wells">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Wells
          </Link>
        </Button>
      </div>

      <CreateWellForm />
    </div>
  );
}
