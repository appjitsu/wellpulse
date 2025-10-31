#!/bin/bash

##
## Generate Root CA Certificate for Azure IoT Hub
##
## Usage:
##   ./generate-root-ca.sh
##
## Output:
##   - root-ca.key (KEEP SECURE - private key)
##   - root-ca.crt (Upload to Azure IoT Hub)
##

set -e

echo "🔐 Generating Root CA Certificate for WellPulse IoT Hub..."
echo ""

# Configuration
CERT_DIR="$(cd "$(dirname "$0")" && pwd)"
DAYS_VALID=3650  # 10 years
COUNTRY="US"
STATE="Texas"
CITY="Midland"
ORG="WellPulse"
OU="IoT Infrastructure"
CN="WellPulse Root CA"

# Generate private key
echo "📝 Step 1: Generating root CA private key..."
openssl genrsa -out "$CERT_DIR/root-ca.key" 4096
chmod 600 "$CERT_DIR/root-ca.key"
echo "   ✅ root-ca.key created (4096-bit RSA)"

# Generate root CA certificate
echo ""
echo "📝 Step 2: Generating root CA certificate..."
openssl req -x509 -new -nodes \
  -key "$CERT_DIR/root-ca.key" \
  -sha256 \
  -days $DAYS_VALID \
  -out "$CERT_DIR/root-ca.crt" \
  -subj "/C=$COUNTRY/ST=$STATE/L=$CITY/O=$ORG/OU=$OU/CN=$CN"
echo "   ✅ root-ca.crt created (valid for 10 years)"

# Display certificate details
echo ""
echo "📋 Root CA Certificate Details:"
openssl x509 -in "$CERT_DIR/root-ca.crt" -text -noout | grep -E "(Subject:|Not Before|Not After)"

echo ""
echo "✅ Root CA certificate generated successfully!"
echo ""
echo "⚠️  SECURITY WARNING:"
echo "   - Keep root-ca.key SECURE (private key)"
echo "   - Upload root-ca.crt to Azure IoT Hub"
echo "   - DO NOT commit private keys to version control"
echo ""
echo "📤 Next Steps:"
echo "   1. Upload root-ca.crt to Azure IoT Hub:"
echo "      az iot hub certificate create \\"
echo "        --hub-name iothub-wellpulse-<tenant>-prod \\"
echo "        --name wellpulse-root-ca \\"
echo "        --path $CERT_DIR/root-ca.crt"
echo ""
echo "   2. Verify certificate ownership (Azure will provide verification code):"
echo "      ./generate-verification-cert.sh <VERIFICATION_CODE>"
echo ""
