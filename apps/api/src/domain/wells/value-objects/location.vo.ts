/**
 * Location Value Object
 *
 * Encapsulates geographic coordinates (latitude/longitude) with validation.
 * Used for well site locations in the Permian Basin.
 *
 * Business Rules:
 * - Latitude must be between -90 and 90 degrees
 * - Longitude must be between -180 and 180 degrees
 * - Supports distance calculation using Haversine formula
 * - Immutable once created
 */
export class Location {
  private constructor(
    private readonly _latitude: number,
    private readonly _longitude: number,
  ) {}

  static create(latitude: number, longitude: number): Location {
    // Business rule: Latitude must be valid (-90 to 90)
    if (latitude < -90 || latitude > 90) {
      throw new Error(
        `Invalid latitude: ${latitude}. Must be between -90 and 90 degrees.`,
      );
    }

    // Business rule: Longitude must be valid (-180 to 180)
    if (longitude < -180 || longitude > 180) {
      throw new Error(
        `Invalid longitude: ${longitude}. Must be between -180 and 180 degrees.`,
      );
    }

    return new Location(latitude, longitude);
  }

  get latitude(): number {
    return this._latitude;
  }

  get longitude(): number {
    return this._longitude;
  }

  /**
   * Calculate distance to another location using Haversine formula
   * Returns distance in miles
   *
   * Haversine formula:
   * a = sin²(Δφ/2) + cos(φ1) × cos(φ2) × sin²(Δλ/2)
   * c = 2 × atan2(√a, √(1−a))
   * d = R × c
   *
   * where φ is latitude, λ is longitude, R is earth's radius
   */
  distanceTo(other: Location): number {
    const EARTH_RADIUS_MILES = 3959; // Mean radius of Earth in miles

    // Convert degrees to radians
    const lat1 = this.toRadians(this._latitude);
    const lat2 = this.toRadians(other._latitude);
    const deltaLat = this.toRadians(other._latitude - this._latitude);
    const deltaLon = this.toRadians(other._longitude - this._longitude);

    // Haversine formula
    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(deltaLon / 2) *
        Math.sin(deltaLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_MILES * c;
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Check if two locations are equal
   * Uses small epsilon for floating-point comparison
   */
  equals(other: Location): boolean {
    const EPSILON = 0.000001; // ~0.1 meters precision
    return (
      Math.abs(this._latitude - other._latitude) < EPSILON &&
      Math.abs(this._longitude - other._longitude) < EPSILON
    );
  }

  /**
   * Convert to plain object for serialization
   */
  toJSON(): { latitude: number; longitude: number } {
    return {
      latitude: this._latitude,
      longitude: this._longitude,
    };
  }

  toString(): string {
    return `${this._latitude}, ${this._longitude}`;
  }
}
