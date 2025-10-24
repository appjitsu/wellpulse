import { Email } from './email.vo';

describe('Email Value Object', () => {
  describe('create()', () => {
    describe('Valid Email Formats', () => {
      it('should create email with basic format', () => {
        const email = Email.create('user@example.com');

        expect(email.value).toBe('user@example.com');
        expect(email.toString()).toBe('user@example.com');
      });

      it('should create email with subdomain', () => {
        const email = Email.create('user@mail.example.com');

        expect(email.value).toBe('user@mail.example.com');
      });

      it('should create email with multiple subdomains', () => {
        const email = Email.create('user@corp.mail.example.com');

        expect(email.value).toBe('user@corp.mail.example.com');
      });

      it('should create email with plus addressing', () => {
        const email = Email.create('user+tag@example.com');

        expect(email.value).toBe('user+tag@example.com');
      });

      it('should create email with dots in local part', () => {
        const email = Email.create('first.last@example.com');

        expect(email.value).toBe('first.last@example.com');
      });

      it('should create email with numbers in local part', () => {
        const email = Email.create('user123@example.com');

        expect(email.value).toBe('user123@example.com');
      });

      it('should create email with numbers in domain', () => {
        const email = Email.create('user@example123.com');

        expect(email.value).toBe('user@example123.com');
      });

      it('should create email with hyphens in domain', () => {
        const email = Email.create('user@my-company.com');

        expect(email.value).toBe('user@my-company.com');
      });

      it('should create email with underscores in local part', () => {
        const email = Email.create('first_last@example.com');

        expect(email.value).toBe('first_last@example.com');
      });

      it('should create email with long TLD', () => {
        const email = Email.create('user@example.technology');

        expect(email.value).toBe('user@example.technology');
      });

      it('should create email with short TLD', () => {
        const email = Email.create('user@example.io');

        expect(email.value).toBe('user@example.io');
      });

      it('should create email with country code TLD', () => {
        const email = Email.create('user@example.co.uk');

        expect(email.value).toBe('user@example.co.uk');
      });

      it('should create email with numbers and special characters', () => {
        const email = Email.create('user+123_test@mail-server.example.com');

        expect(email.value).toBe('user+123_test@mail-server.example.com');
      });
    });

    describe('Email Normalization', () => {
      it('should convert email to lowercase', () => {
        const email = Email.create('USER@EXAMPLE.COM');

        expect(email.value).toBe('user@example.com');
      });

      it('should convert mixed case email to lowercase', () => {
        const email = Email.create('UsEr@ExAmPlE.CoM');

        expect(email.value).toBe('user@example.com');
      });

      it('should trim leading whitespace', () => {
        const email = Email.create('   user@example.com');

        expect(email.value).toBe('user@example.com');
      });

      it('should trim trailing whitespace', () => {
        const email = Email.create('user@example.com   ');

        expect(email.value).toBe('user@example.com');
      });

      it('should trim both leading and trailing whitespace', () => {
        const email = Email.create('   user@example.com   ');

        expect(email.value).toBe('user@example.com');
      });

      it('should trim and convert to lowercase simultaneously', () => {
        const email = Email.create('   USER@EXAMPLE.COM   ');

        expect(email.value).toBe('user@example.com');
      });

      it('should handle tabs and normalize', () => {
        const email = Email.create('\tuser@example.com\t');

        expect(email.value).toBe('user@example.com');
      });

      it('should handle newlines and normalize', () => {
        const email = Email.create('\nuser@example.com\n');

        expect(email.value).toBe('user@example.com');
      });
    });

    describe('Invalid Email Formats', () => {
      it('should throw error for email without @ symbol', () => {
        expect(() => Email.create('userexample.com')).toThrow(
          'Invalid email format: userexample.com',
        );
      });

      it('should throw error for email without domain', () => {
        expect(() => Email.create('user@')).toThrow(
          'Invalid email format: user@',
        );
      });

      it('should throw error for email without local part', () => {
        expect(() => Email.create('@example.com')).toThrow(
          'Invalid email format: @example.com',
        );
      });

      it('should throw error for email without TLD', () => {
        expect(() => Email.create('user@example')).toThrow(
          'Invalid email format: user@example',
        );
      });

      it('should throw error for email with spaces in local part', () => {
        expect(() => Email.create('user name@example.com')).toThrow(
          'Invalid email format: user name@example.com',
        );
      });

      it('should throw error for email with spaces in domain', () => {
        expect(() => Email.create('user@example .com')).toThrow(
          'Invalid email format: user@example .com',
        );
      });

      it('should throw error for email with multiple @ symbols', () => {
        expect(() => Email.create('user@@example.com')).toThrow(
          'Invalid email format: user@@example.com',
        );
      });

      it('should throw error for email with @ in wrong position', () => {
        expect(() => Email.create('user@domain@example.com')).toThrow(
          'Invalid email format: user@domain@example.com',
        );
      });

      it('should throw error for empty string', () => {
        expect(() => Email.create('')).toThrow('Invalid email format: ');
      });

      it('should throw error for whitespace only', () => {
        expect(() => Email.create('   ')).toThrow('Invalid email format:    ');
      });

      it('should throw error for missing domain extension', () => {
        expect(() => Email.create('user@domain.')).toThrow(
          'Invalid email format: user@domain.',
        );
      });
    });

    describe('Length Validation', () => {
      it('should accept email at maximum length (255 characters)', () => {
        // Create a 255-character email: local part (64) + @ (1) + domain (190)
        const localPart = 'a'.repeat(64);
        const domainPart = 'b'.repeat(186) + '.com';
        const maxEmail = `${localPart}@${domainPart}`;

        const email = Email.create(maxEmail);

        expect(email.value).toBe(maxEmail.toLowerCase());
        expect(email.value.length).toBe(255);
      });

      it('should throw error for email exceeding 255 characters', () => {
        // Create a 256-character email
        const localPart = 'a'.repeat(64);
        const domainPart = 'b'.repeat(187) + '.com';
        const longEmail = `${localPart}@${domainPart}`;

        expect(() => Email.create(longEmail)).toThrow(
          'Email must not exceed 255 characters',
        );
      });

      it('should throw error for very long email', () => {
        const veryLongEmail = `${'a'.repeat(300)}@example.com`;

        expect(() => Email.create(veryLongEmail)).toThrow(
          'Email must not exceed 255 characters',
        );
      });

      it('should accept short email (minimum valid length)', () => {
        const email = Email.create('a@b.c');

        expect(email.value).toBe('a@b.c');
      });
    });
  });

  describe('value getter', () => {
    it('should return the normalized email value', () => {
      const email = Email.create('USER@EXAMPLE.COM');

      expect(email.value).toBe('user@example.com');
    });

    it('should return consistent value on multiple calls', () => {
      const email = Email.create('user@example.com');

      expect(email.value).toBe('user@example.com');
      expect(email.value).toBe('user@example.com');
      expect(email.value).toBe('user@example.com');
    });

    it('should return the same value as toString()', () => {
      const email = Email.create('user@example.com');

      expect(email.value).toBe(email.toString());
    });
  });

  describe('toString()', () => {
    it('should return string representation of email', () => {
      const email = Email.create('user@example.com');

      expect(email.toString()).toBe('user@example.com');
    });

    it('should return normalized email string', () => {
      const email = Email.create('USER@EXAMPLE.COM');

      expect(email.toString()).toBe('user@example.com');
    });

    it('should be usable in string concatenation', () => {
      const email = Email.create('user@example.com');
      const message = `Email: ${email.toString()}`;

      expect(message).toBe('Email: user@example.com');
    });

    it('should return consistent string on multiple calls', () => {
      const email = Email.create('user@example.com');

      expect(email.toString()).toBe('user@example.com');
      expect(email.toString()).toBe('user@example.com');
    });
  });

  describe('equals()', () => {
    it('should return true for identical emails', () => {
      const email1 = Email.create('user@example.com');
      const email2 = Email.create('user@example.com');

      expect(email1.equals(email2)).toBe(true);
    });

    it('should return true for emails with different casing (normalized)', () => {
      const email1 = Email.create('USER@EXAMPLE.COM');
      const email2 = Email.create('user@example.com');

      expect(email1.equals(email2)).toBe(true);
    });

    it('should return true for emails with different whitespace (normalized)', () => {
      const email1 = Email.create('  user@example.com  ');
      const email2 = Email.create('user@example.com');

      expect(email1.equals(email2)).toBe(true);
    });

    it('should return false for different emails', () => {
      const email1 = Email.create('user1@example.com');
      const email2 = Email.create('user2@example.com');

      expect(email1.equals(email2)).toBe(false);
    });

    it('should return false for different domains', () => {
      const email1 = Email.create('user@example1.com');
      const email2 = Email.create('user@example2.com');

      expect(email1.equals(email2)).toBe(false);
    });

    it('should return false for different TLDs', () => {
      const email1 = Email.create('user@example.com');
      const email2 = Email.create('user@example.org');

      expect(email1.equals(email2)).toBe(false);
    });

    it('should handle plus addressing as different emails', () => {
      const email1 = Email.create('user@example.com');
      const email2 = Email.create('user+tag@example.com');

      expect(email1.equals(email2)).toBe(false);
    });

    it('should be symmetric', () => {
      const email1 = Email.create('user@example.com');
      const email2 = Email.create('user@example.com');

      expect(email1.equals(email2)).toBe(email2.equals(email1));
    });

    it('should be reflexive', () => {
      const email = Email.create('user@example.com');

      expect(email.equals(email)).toBe(true);
    });

    it('should be transitive', () => {
      const email1 = Email.create('user@example.com');
      const email2 = Email.create('USER@EXAMPLE.COM');
      const email3 = Email.create('  user@example.com  ');

      expect(email1.equals(email2)).toBe(true);
      expect(email2.equals(email3)).toBe(true);
      expect(email1.equals(email3)).toBe(true);
    });
  });

  describe('Immutability', () => {
    it('should maintain state consistency', () => {
      const email = Email.create('user@example.com');

      // Value should be readonly at TypeScript level
      // This test verifies the email maintains its state
      expect(email.value).toBe('user@example.com');
      expect(email.toString()).toBe('user@example.com');

      // Multiple calls should return consistent results
      expect(email.value).toBe('user@example.com');
      expect(email.toString()).toBe('user@example.com');
    });

    it('should create new instances rather than modifying existing ones', () => {
      const email1 = Email.create('user1@example.com');
      const email2 = Email.create('user2@example.com');

      // Both should maintain their original state
      expect(email1.value).toBe('user1@example.com');
      expect(email2.value).toBe('user2@example.com');
    });

    it('should use private constructor (TypeScript enforced)', () => {
      // TypeScript prevents direct instantiation at compile time
      // This test documents that instances can only be created via factory method
      const email = Email.create('user@example.com');

      expect(email).toBeInstanceOf(Email);
      expect(email.value).toBe('user@example.com');
    });

    it('should not allow modification of internal state', () => {
      const email = Email.create('user@example.com');
      const initialValue = email.value;

      // Attempt to modify (should not be possible due to readonly)
      // TypeScript prevents this at compile time
      // This test verifies the value remains constant
      expect(email.value).toBe(initialValue);
      expect(email.value).toBe('user@example.com');
    });
  });

  describe('Edge Cases', () => {
    it('should handle email with maximum local part length', () => {
      const localPart = 'a'.repeat(64);
      const email = Email.create(`${localPart}@example.com`);

      expect(email.value).toBe(`${localPart}@example.com`);
    });

    it('should handle email with minimum valid parts', () => {
      const email = Email.create('a@b.c');

      expect(email.value).toBe('a@b.c');
    });

    it('should handle complex real-world emails', () => {
      const emails = [
        'john.doe+newsletter@corporate-mail.example.com',
        'admin_user123@test-server.co.uk',
        'support+ticket789@help.example.io',
        'user.name+tag+sorting@company.mail.example.org',
      ];

      emails.forEach((emailStr) => {
        const email = Email.create(emailStr);
        expect(email.value).toBe(emailStr.toLowerCase());
      });
    });

    it('should handle multiple operations on same instance', () => {
      const email = Email.create('USER@EXAMPLE.COM');

      expect(email.value).toBe('user@example.com');
      expect(email.value).toBe('user@example.com');
      expect(email.toString()).toBe('user@example.com');
      expect(email.toString()).toBe('user@example.com');
    });

    it('should maintain consistency across operations', () => {
      const email1 = Email.create('USER@EXAMPLE.COM');
      const email2 = Email.create(email1.toString());

      expect(email1.equals(email2)).toBe(true);
      expect(email1.value).toBe(email2.value);
      expect(email1.toString()).toBe(email2.toString());
    });

    it('should handle email recreation from normalized value', () => {
      const originalEmail = '  USER@EXAMPLE.COM  ';
      const email1 = Email.create(originalEmail);
      const email2 = Email.create(email1.value);

      expect(email1.equals(email2)).toBe(true);
      expect(email1.value).toBe(email2.value);
    });

    it('should handle comparison with different normalizations', () => {
      const emails = [
        Email.create('USER@EXAMPLE.COM'),
        Email.create('user@example.com'),
        Email.create('  user@example.com  '),
        Email.create('UsEr@ExAmPlE.cOm'),
      ];

      // All should be equal after normalization
      for (let i = 0; i < emails.length; i++) {
        for (let j = 0; j < emails.length; j++) {
          expect(emails[i].equals(emails[j])).toBe(true);
        }
      }
    });
  });

  describe('Error Messages', () => {
    it('should include original input in invalid format error', () => {
      const invalidEmail = 'not-an-email';

      expect(() => Email.create(invalidEmail)).toThrow(
        `Invalid email format: ${invalidEmail}`,
      );
    });

    it('should preserve original input in error message (before normalization)', () => {
      const invalidEmail = 'NOT AN EMAIL';

      expect(() => Email.create(invalidEmail)).toThrow(
        `Invalid email format: ${invalidEmail}`,
      );
    });

    it('should show clear error for length violation', () => {
      const longEmail = `${'a'.repeat(300)}@example.com`;

      expect(() => Email.create(longEmail)).toThrow(
        'Email must not exceed 255 characters',
      );
    });

    it('should prioritize format validation over length validation', () => {
      // Invalid format (no domain) that would also be too long
      const invalidLongEmail = 'a'.repeat(300);

      expect(() => Email.create(invalidLongEmail)).toThrow(
        `Invalid email format: ${invalidLongEmail}`,
      );
    });
  });

  describe('Type Safety', () => {
    it('should be type-safe with TypeScript', () => {
      const email = Email.create('user@example.com');

      // TypeScript ensures these methods exist and return correct types
      const value: string = email.value;
      const str: string = email.toString();
      const isEqual: boolean = email.equals(email);

      expect(typeof value).toBe('string');
      expect(typeof str).toBe('string');
      expect(typeof isEqual).toBe('boolean');
    });

    it('should enforce Email type in equals method', () => {
      const email1 = Email.create('user@example.com');
      const email2 = Email.create('user@example.com');

      // TypeScript ensures only Email instances can be compared
      expect(email1.equals(email2)).toBe(true);
    });
  });
});
