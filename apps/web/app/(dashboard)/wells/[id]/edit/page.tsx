/**
 * Edit Well Page
 *
 * Page for editing an existing well.
 * Restricted to Admins and Managers only.
 */

'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { EditWellForm } from '@/components/wells/edit-well-form';

export default function EditWellPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const wellId = params.id as string;

  // Redirect if not authorized (Operators cannot edit)
  useEffect(() => {
    if (!isLoading && user && user.role === 'OPERATOR') {
      router.push(`/wells/${wellId}`);
    }
  }, [user, isLoading, router, wellId]);

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
          <Link href={`/wells/${wellId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Well
          </Link>
        </Button>
      </div>

      <EditWellForm wellId={wellId} />
    </div>
  );
}
