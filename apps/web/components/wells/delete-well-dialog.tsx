/**
 * Delete Well Dialog Component
 *
 * Confirmation dialog for deleting a well.
 * Uses optimistic updates and shows loading state.
 */

'use client';

import { useState } from 'react';
import { useDeleteWell, useWell } from '@/hooks/use-wells';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface DeleteWellDialogProps {
  wellId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteWellDialog({ wellId, open, onOpenChange }: DeleteWellDialogProps) {
  const { data: well } = useWell(wellId);
  const deleteWell = useDeleteWell();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteWell.mutateAsync(wellId);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to delete well:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Well</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete {well?.name}? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
