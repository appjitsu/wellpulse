#!/bin/bash

##
## Generate Verification Certificate for Azure IoT Hub Root CA
##
## Azure requires proof-of-possession to verify you own the root CA.
## This script generates a verification certificate signed with your root CA.
##
## Usage:
##   ./generate-verification-cert.sh <verification-code>
##
## The verification code is provided by Azure after uploading root-ca.crt
##

set -e

# Check arguments
if [ $# -lt 1 ]; then
  echo "Usage: $0 <verification-code>"
  echo ""
  echo "To get verification code:"
  echo "  1. Upload root CA to Azure IoT Hub"
  echo "  2. Azure will display a verification code"
  echo "  3. Run this script with that code"
  exit 1
fi

VERIFICATION_CODE=$1
CERT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Verify root CA exists
if [ ! -f "$CERT_DIR/root-ca.key" ] || [ ! -f "$CERT_DIR/root-ca.crt" ]; then
  echo "❌ Error: Root CA certificate not found!"
  echo "   Run ./generate-root-ca.sh first"
  exit 1
fi

echo "🔐 Generating verification certificate for Azure IoT Hub..."
echo "   Verification Code: $VERIFICATION_CODE"
echo ""

# Generate verification private key
echo "📝 Step 1: Generating verification private key..."
openssl genrsa -out "$CERT_DIR/verification.key" 2048
chmod 600 "$CERT_DIR/verification.key"
echo "   ✅ verification.key created"

# Generate verification certificate signing request
echo ""
echo "📝 Step 2: Generating verification CSR..."
openssl req -new \
  -key "$CERT_DIR/verification.key" \
  -out "$CERT_DIR/verification.csr" \
  -subj "/CN=$VERIFICATION_CODE"
echo "   ✅ verification.csr created"

# Sign verification certificate with root CA
echo ""
echo "📝 Step 3: Signing verification certificate with root CA..."
openssl x509 -req \
  -in "$CERT_DIR/verification.csr" \
  -CA "$CERT_DIR/root-ca.crt" \
  -CAkey "$CERT_DIR/root-ca.key" \
  -CAcreateserial \
  -out "$CERT_DIR/root-ca-verification.crt" \
  -days 30 \
  -sha256
echo "   ✅ root-ca-verification.crt created"

# Cleanup
rm "$CERT_DIR/verification.key"
rm "$CERT_DIR/verification.csr"

# Display certificate details
echo ""
echo "📋 Verification Certificate Details:"
openssl x509 -in "$CERT_DIR/root-ca-verification.crt" -text -noout | grep -E "(Subject:|CN=)"

echo ""
echo "✅ Verification certificate generated successfully!"
echo ""
echo "📤 Next Step:"
echo "   Verify root CA ownership in Azure:"
echo ""
echo "   az iot hub certificate verify \\"
echo "     --hub-name iothub-wellpulse-<tenant>-prod \\"
echo "     --name wellpulse-root-ca \\"
echo "     --path $CERT_DIR/root-ca-verification.crt"
echo ""
