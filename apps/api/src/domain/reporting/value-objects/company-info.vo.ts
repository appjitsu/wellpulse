/**
 * Company Info Value Object
 *
 * Encapsulates company information for report branding.
 * Used in headers/footers of PDF reports.
 */

export interface CompanyInfoProps {
  companyName: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string | null;
  email: string | null;
  website: string | null;
}

export class CompanyInfo {
  private constructor(private readonly props: CompanyInfoProps) {
    this.validate();
  }

  static create(props: CompanyInfoProps): CompanyInfo {
    return new CompanyInfo(props);
  }

  get companyName(): string {
    return this.props.companyName;
  }

  get address(): string {
    return this.props.address;
  }

  get city(): string {
    return this.props.city;
  }

  get state(): string {
    return this.props.state;
  }

  get zipCode(): string {
    return this.props.zipCode;
  }

  get phone(): string | null {
    return this.props.phone;
  }

  get email(): string | null {
    return this.props.email;
  }

  get website(): string | null {
    return this.props.website;
  }

  /**
   * Get formatted full address for PDF reports
   */
  getFormattedAddress(): string {
    return `${this.address}\n${this.city}, ${this.state} ${this.zipCode}`;
  }

  /**
   * Get formatted contact info
   */
  getFormattedContact(): string {
    const lines: string[] = [];

    if (this.phone) {
      lines.push(`Phone: ${this.phone}`);
    }
    if (this.email) {
      lines.push(`Email: ${this.email}`);
    }
    if (this.website) {
      lines.push(`Web: ${this.website}`);
    }

    return lines.join('\n');
  }

  /**
   * Check if two company infos are equal
   */
  equals(other: CompanyInfo): boolean {
    return (
      this.companyName === other.companyName &&
      this.address === other.address &&
      this.city === other.city &&
      this.state === other.state &&
      this.zipCode === other.zipCode &&
      this.phone === other.phone &&
      this.email === other.email &&
      this.website === other.website
    );
  }

  private validate(): void {
    if (!this.props.companyName || this.props.companyName.trim().length < 2) {
      throw new Error('Company name must be at least 2 characters');
    }

    if (this.props.companyName.length > 255) {
      throw new Error('Company name must not exceed 255 characters');
    }

    if (!this.props.address || this.props.address.trim().length < 5) {
      throw new Error('Address must be at least 5 characters');
    }

    if (!this.props.city || this.props.city.trim().length < 2) {
      throw new Error('City must be at least 2 characters');
    }

    if (!this.props.state || !this.isValidUsState(this.props.state)) {
      throw new Error('State must be a valid 2-letter US state code');
    }

    if (!this.props.zipCode || !this.isValidZipCode(this.props.zipCode)) {
      throw new Error('Zip code must be in format XXXXX or XXXXX-XXXX');
    }

    if (this.props.phone && !this.isValidPhone(this.props.phone)) {
      throw new Error(
        'Phone number must be in format XXX-XXX-XXXX or (XXX) XXX-XXXX',
      );
    }

    if (this.props.email && !this.isValidEmail(this.props.email)) {
      throw new Error('Invalid email format');
    }

    if (this.props.website && !this.isValidWebsite(this.props.website)) {
      throw new Error('Invalid website URL format');
    }
  }

  private isValidUsState(state: string): boolean {
    const US_STATES = [
      'AL',
      'AK',
      'AZ',
      'AR',
      'CA',
      'CO',
      'CT',
      'DE',
      'FL',
      'GA',
      'HI',
      'ID',
      'IL',
      'IN',
      'IA',
      'KS',
      'KY',
      'LA',
      'ME',
      'MD',
      'MA',
      'MI',
      'MN',
      'MS',
      'MO',
      'MT',
      'NE',
      'NV',
      'NH',
      'NJ',
      'NM',
      'NY',
      'NC',
      'ND',
      'OH',
      'OK',
      'OR',
      'PA',
      'RI',
      'SC',
      'SD',
      'TN',
      'TX',
      'UT',
      'VT',
      'VA',
      'WA',
      'WV',
      'WI',
      'WY',
    ];
    return US_STATES.includes(state.toUpperCase());
  }

  private isValidZipCode(zipCode: string): boolean {
    // Matches XXXXX or XXXXX-XXXX
    return /^\d{5}(-\d{4})?$/.test(zipCode);
  }

  private isValidPhone(phone: string): boolean {
    // Matches XXX-XXX-XXXX or (XXX) XXX-XXXX
    return /^(\d{3}-\d{3}-\d{4}|\(\d{3}\) \d{3}-\d{4})$/.test(phone);
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private isValidWebsite(website: string): boolean {
    try {
      new URL(website);
      return true;
    } catch {
      return false;
    }
  }
}
