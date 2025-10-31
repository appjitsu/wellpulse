/**
 * Branding Configuration Form
 *
 * White-label report branding settings for tenant customization.
 * Features:
 * - Company logo upload with preview (PNG/JPG, max 2MB)
 * - Primary/secondary/text/background color pickers
 * - Company information (name, address, phone, website)
 * - Report header/footer customization
 * - Live PDF preview
 *
 * Pattern References:
 * - Strategy Pattern (Azure Blob Storage for logo uploads)
 * - Form Validation Pattern
 * - Optimistic UI Updates
 *
 * @see docs/sprints/sprint-5-implementation-spec.md:2053-2179
 * @see docs/patterns/80-White-Label-PDF-Report-Generation-Pattern.md
 */

'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Upload, X, Eye, Save, AlertCircle, CheckCircle } from 'lucide-react';
import { useBranding } from '@/hooks/use-branding';
import { Textarea } from '@/components/ui/textarea';

/**
 * Form validation schema
 */
const brandingFormSchema = z.object({
  companyName: z.string().min(2, 'Company name must be at least 2 characters').max(100),
  companyAddress: z.string().max(500).optional(),
  companyPhone: z.string().max(20).optional(),
  companyWebsite: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color (e.g., #FF5733)'),
  secondaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color (e.g., #FF5733)'),
  textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color (e.g., #333333)'),
  backgroundColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color (e.g., #FFFFFF)'),
  reportHeader: z.string().max(200).optional(),
  reportFooter: z.string().max(200).optional(),
});

type BrandingFormValues = z.infer<typeof brandingFormSchema>;

interface BrandingConfigurationFormProps {
  onPreview?: () => void;
}

export function BrandingConfigurationForm({ onPreview }: BrandingConfigurationFormProps) {
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { branding, isLoading, updateBranding, uploadLogo } = useBranding();

  const form = useForm<BrandingFormValues>({
    resolver: zodResolver(brandingFormSchema),
    defaultValues: {
      companyName: branding?.companyName || '',
      companyAddress: branding?.companyAddress || '',
      companyPhone: branding?.companyPhone || '',
      companyWebsite: branding?.companyWebsite || '',
      primaryColor: branding?.primaryColor || '#3b82f6',
      secondaryColor: branding?.secondaryColor || '#8b5cf6',
      textColor: branding?.textColor || '#1e293b',
      backgroundColor: branding?.backgroundColor || '#ffffff',
      reportHeader: branding?.reportHeader || '',
      reportFooter: branding?.reportFooter || '',
    },
  });

  /**
   * Handle logo file selection
   */
  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.match(/^image\/(png|jpeg|jpg)$/)) {
      alert('Please select a PNG or JPG image');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Logo file must be less than 2MB');
      return;
    }

    setLogoFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setLogoPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  /**
   * Remove logo
   */
  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Handle form submission
   */
  const onSubmit = async (values: BrandingFormValues) => {
    try {
      setSaveSuccess(false);

      // Upload logo first if selected
      if (logoFile) {
        setUploadProgress(0);
        // Note: Progress tracking would be handled by axios interceptors if needed
        await uploadLogo.mutateAsync(logoFile);
        setUploadProgress(100);
      }

      // Update branding settings
      await updateBranding.mutateAsync(values);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save branding:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-slate-600">Loading branding settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success Message */}
      {saveSuccess && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Branding settings saved successfully!
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Company Logo */}
          <Card>
            <CardHeader>
              <CardTitle>Company Logo</CardTitle>
              <CardDescription>
                Upload your company logo for PDF reports (PNG or JPG, max 2MB)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Logo Preview */}
              {(logoPreview || branding?.logoUrl) && (
                <div className="flex items-center gap-4">
                  <div className="relative w-48 h-32 border rounded-lg overflow-hidden bg-slate-50 flex items-center justify-center">
                    <Image
                      src={logoPreview || branding?.logoUrl || ''}
                      alt="Logo preview"
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveLogo}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Remove
                  </Button>
                </div>
              )}

              {/* Upload Button */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={handleLogoChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {logoPreview || branding?.logoUrl ? 'Change Logo' : 'Upload Logo'}
                </Button>
              </div>

              {/* Upload Progress */}
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Company Information */}
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>This information will appear on PDF reports</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme Oil & Gas" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="companyAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea placeholder="123 Main St, Midland, TX 79701" rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="companyPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="(432) 555-0123" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="companyWebsite"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Brand Colors */}
          <Card>
            <CardHeader>
              <CardTitle>Brand Colors</CardTitle>
              <CardDescription>
                Customize colors for PDF reports (hex format, e.g., #FF5733)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="primaryColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Color</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input type="color" {...field} className="w-16 h-10 p-1" />
                        </FormControl>
                        <FormControl>
                          <Input {...field} placeholder="#3b82f6" />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="secondaryColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Secondary Color</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input type="color" {...field} className="w-16 h-10 p-1" />
                        </FormControl>
                        <FormControl>
                          <Input {...field} placeholder="#8b5cf6" />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="textColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Text Color</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input type="color" {...field} className="w-16 h-10 p-1" />
                        </FormControl>
                        <FormControl>
                          <Input {...field} placeholder="#1e293b" />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="backgroundColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Background Color</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input type="color" {...field} className="w-16 h-10 p-1" />
                        </FormControl>
                        <FormControl>
                          <Input {...field} placeholder="#ffffff" />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Report Customization */}
          <Card>
            <CardHeader>
              <CardTitle>Report Customization</CardTitle>
              <CardDescription>Custom headers and footers for PDF reports</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="reportHeader"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Report Header</FormLabel>
                    <FormControl>
                      <Input placeholder="Monthly Production Report" {...field} />
                    </FormControl>
                    <FormDescription>
                      Optional text to appear at the top of PDF reports
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reportFooter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Report Footer</FormLabel>
                    <FormControl>
                      <Input placeholder="Confidential - For Internal Use Only" {...field} />
                    </FormControl>
                    <FormDescription>
                      Optional text to appear at the bottom of PDF reports
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Error Alert */}
          {updateBranding.isError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {updateBranding.error instanceof Error
                  ? updateBranding.error.message
                  : 'Failed to save branding settings. Please try again.'}
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={updateBranding.isPending || uploadLogo.isPending}
              className="flex-1"
            >
              {updateBranding.isPending || uploadLogo.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
            {onPreview && (
              <Button type="button" variant="outline" onClick={onPreview}>
                <Eye className="w-4 h-4 mr-2" />
                Preview PDF
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
