/**
 * PDF Preview Dialog
 *
 * Shows a live preview of white-labeled PDF reports with current branding.
 * Features:
 * - Real-time rendering of branded PDF layout
 * - Sample production report content
 * - Download sample PDF
 * - Shows logo, colors, header/footer
 *
 * Pattern References:
 * - Strategy Pattern (PDF generation with branding)
 * - Observer Pattern (live branding updates)
 *
 * @see docs/patterns/80-White-Label-PDF-Report-Generation-Pattern.md
 */

'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Download, AlertCircle } from 'lucide-react';
import { useBranding } from '@/hooks/use-branding';

interface PdfPreviewDialogProps {
  open: boolean;
  onClose: () => void;
}

export function PdfPreviewDialog({ open, onClose }: PdfPreviewDialogProps) {
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const { branding, isLoading } = useBranding();

  /**
   * Handle sample PDF download
   */
  const handleDownloadSample = async () => {
    setDownloadingPdf(true);
    setDownloadError(null);

    try {
      // Call API to generate sample PDF with current branding
      const response = await fetch('/api/admin/branding/generate-sample-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      // Download PDF blob
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${branding?.companyName || 'WellPulse'}_Sample_Report.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download sample PDF:', error);
      setDownloadError('Failed to generate sample PDF. Please try again.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-3 text-slate-600">Loading preview...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>PDF Report Preview</DialogTitle>
          <DialogDescription>
            Preview of how your white-labeled PDF reports will appear with current branding settings
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* PDF Preview Frame */}
          <div
            className="border rounded-lg overflow-hidden bg-white shadow-lg p-8"
            style={{
              backgroundColor: branding?.backgroundColor || '#ffffff',
              color: branding?.textColor || '#1e293b',
            }}
          >
            {/* Header */}
            {branding?.reportHeader && (
              <div
                className="text-center py-4 mb-6 border-b"
                style={{ borderColor: branding.primaryColor }}
              >
                <h2 className="text-xl font-bold" style={{ color: branding.primaryColor }}>
                  {branding.reportHeader}
                </h2>
              </div>
            )}

            {/* Logo and Company Info */}
            <div className="flex items-start justify-between mb-8">
              <div>
                {branding?.logoUrl && (
                  <Image
                    src={branding.logoUrl}
                    alt={branding.companyName}
                    width={192}
                    height={64}
                    className="h-16 mb-4 object-contain"
                    unoptimized
                  />
                )}
                <h1 className="text-2xl font-bold mb-2">{branding?.companyName}</h1>
                {branding?.companyAddress && (
                  <p className="text-sm whitespace-pre-line">{branding.companyAddress}</p>
                )}
                {branding?.companyPhone && (
                  <p className="text-sm">Phone: {branding.companyPhone}</p>
                )}
                {branding?.companyWebsite && (
                  <p className="text-sm">Website: {branding.companyWebsite}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold mb-1">Production Report</p>
                <p className="text-sm">Date: {new Date().toLocaleDateString()}</p>
                <p className="text-sm">Report ID: #12345</p>
              </div>
            </div>

            {/* Sample Content */}
            <div className="space-y-6">
              {/* Executive Summary */}
              <div>
                <h3
                  className="text-lg font-semibold mb-3 pb-2 border-b"
                  style={{
                    color: branding?.primaryColor,
                    borderColor: branding?.secondaryColor,
                  }}
                >
                  Executive Summary
                </h3>
                <p className="text-sm mb-2">
                  This report summarizes production data for the month of{' '}
                  {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.
                </p>
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div
                    className="p-4 rounded-lg"
                    style={{ backgroundColor: `${branding?.primaryColor}20` }}
                  >
                    <p className="text-xs font-semibold mb-1">Total Oil</p>
                    <p className="text-2xl font-bold" style={{ color: branding?.primaryColor }}>
                      12,450 BBL
                    </p>
                  </div>
                  <div
                    className="p-4 rounded-lg"
                    style={{ backgroundColor: `${branding?.secondaryColor}20` }}
                  >
                    <p className="text-xs font-semibold mb-1">Total Gas</p>
                    <p className="text-2xl font-bold" style={{ color: branding?.secondaryColor }}>
                      8,320 MCF
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-slate-100">
                    <p className="text-xs font-semibold mb-1">Total Water</p>
                    <p className="text-2xl font-bold" style={{ color: branding?.textColor }}>
                      3,210 BBL
                    </p>
                  </div>
                </div>
              </div>

              {/* Well Performance Table */}
              <div>
                <h3
                  className="text-lg font-semibold mb-3 pb-2 border-b"
                  style={{
                    color: branding?.primaryColor,
                    borderColor: branding?.secondaryColor,
                  }}
                >
                  Well Performance
                </h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr
                      className="border-b"
                      style={{
                        backgroundColor: `${branding?.primaryColor}10`,
                        borderColor: branding?.primaryColor,
                      }}
                    >
                      <th className="text-left p-2">Well Name</th>
                      <th className="text-right p-2">Oil (BBL)</th>
                      <th className="text-right p-2">Gas (MCF)</th>
                      <th className="text-right p-2">Water (BBL)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="p-2">Smith #1</td>
                      <td className="text-right p-2">4,200</td>
                      <td className="text-right p-2">2,800</td>
                      <td className="text-right p-2">1,100</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2">Johnson #2</td>
                      <td className="text-right p-2">3,850</td>
                      <td className="text-right p-2">2,500</td>
                      <td className="text-right p-2">980</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2">Williams #3</td>
                      <td className="text-right p-2">4,400</td>
                      <td className="text-right p-2">3,020</td>
                      <td className="text-right p-2">1,130</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            {branding?.reportFooter && (
              <div
                className="text-center py-4 mt-8 border-t text-sm"
                style={{ borderColor: branding.primaryColor }}
              >
                <p>{branding.reportFooter}</p>
              </div>
            )}
          </div>

          {/* Download Error */}
          {downloadError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{downloadError}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handleDownloadSample} disabled={downloadingPdf}>
            {downloadingPdf ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating PDF...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Download Sample PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
