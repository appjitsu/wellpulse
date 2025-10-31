/**
 * OPC-UA Endpoint Value Object
 *
 * Represents an OPC-UA server endpoint configuration for SCADA integration.
 * Encapsulates connection details including security mode and policy.
 *
 * @example
 * const endpoint = OpcUaEndpoint.create({
 *   url: 'opc.tcp://192.168.1.100:4840',
 *   securityMode: 'SignAndEncrypt',
 *   securityPolicy: 'Basic256Sha256'
 * });
 */

export type OpcUaSecurityMode = 'None' | 'Sign' | 'SignAndEncrypt';
export type OpcUaSecurityPolicy =
  | 'None'
  | 'Basic128Rsa15'
  | 'Basic256'
  | 'Basic256Sha256'
  | 'Aes128_Sha256_RsaOaep'
  | 'Aes256_Sha256_RsaPss';

export interface OpcUaEndpointProps {
  url: string;
  securityMode: OpcUaSecurityMode;
  securityPolicy: OpcUaSecurityPolicy;
  username?: string;
  password?: string;
}

export class OpcUaEndpoint {
  private constructor(
    private readonly _url: string,
    private readonly _securityMode: OpcUaSecurityMode,
    private readonly _securityPolicy: OpcUaSecurityPolicy,
    private readonly _username?: string,
    private readonly _password?: string,
  ) {}

  static create(props: OpcUaEndpointProps): OpcUaEndpoint {
    this.validate(props);
    return new OpcUaEndpoint(
      props.url,
      props.securityMode,
      props.securityPolicy,
      props.username,
      props.password,
    );
  }

  private static validate(props: OpcUaEndpointProps): void {
    // Validate URL format
    if (!props.url) {
      throw new Error('OPC-UA endpoint URL is required');
    }

    if (!props.url.startsWith('opc.tcp://')) {
      throw new Error('OPC-UA endpoint URL must start with opc.tcp://');
    }

    // Validate security configuration
    if (props.securityMode === 'None' && props.securityPolicy !== 'None') {
      throw new Error(
        'Security policy must be None when security mode is None',
      );
    }

    if (props.securityMode !== 'None' && props.securityPolicy === 'None') {
      throw new Error(
        'Security policy cannot be None when security mode is not None',
      );
    }

    // Validate credentials if using username/password authentication
    if (props.username && !props.password) {
      throw new Error('Password is required when username is provided');
    }

    if (!props.username && props.password) {
      throw new Error('Username is required when password is provided');
    }
  }

  get url(): string {
    return this._url;
  }

  get securityMode(): OpcUaSecurityMode {
    return this._securityMode;
  }

  get securityPolicy(): OpcUaSecurityPolicy {
    return this._securityPolicy;
  }

  get username(): string | undefined {
    return this._username;
  }

  get password(): string | undefined {
    return this._password;
  }

  get hasCredentials(): boolean {
    return !!(this._username && this._password);
  }

  get isSecure(): boolean {
    return this._securityMode !== 'None';
  }

  /**
   * Extract primitive values for persistence layer
   */
  toPrimitives(): OpcUaEndpointProps {
    return {
      url: this._url,
      securityMode: this._securityMode,
      securityPolicy: this._securityPolicy,
      username: this._username,
      password: this._password,
    };
  }

  /**
   * Reconstruct from primitive values
   */
  static fromPrimitives(props: OpcUaEndpointProps): OpcUaEndpoint {
    return this.create(props);
  }

  equals(other: OpcUaEndpoint): boolean {
    return (
      this._url === other._url &&
      this._securityMode === other._securityMode &&
      this._securityPolicy === other._securityPolicy &&
      this._username === other._username &&
      this._password === other._password
    );
  }

  toString(): string {
    const security =
      this._securityMode === 'None'
        ? 'no security'
        : `${this._securityMode} (${this._securityPolicy})`;
    const auth = this.hasCredentials ? 'with credentials' : 'anonymous';
    return `${this._url} [${security}, ${auth}]`;
  }
}
