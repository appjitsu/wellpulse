#!/bin/bash

##
## Generate Device Certificate for IoT Edge Gateway
##
## Usage:
##   ./generate-device-cert.sh <device-id> [--renew]
##
## Example:
##   ./generate-device-cert.sh gateway-acme-well-001
##
## Output:
##   - <device-id>.key (private key)
##   - <device-id>.crt (device certificate)
##   - <device-id>-chain.crt (certificate chain including root CA)
##

set -e

# Check arguments
if [ $# -lt 1 ]; then
  echo "Usage: $0 <device-id> [--renew]"
  echo ""
  echo "Example:"
  echo "  $0 gateway-acme-well-001"
  exit 1
fi

DEVICE_ID=$1
RENEW_MODE=false

if [ "$2" == "--renew" ]; then
  RENEW_MODE=true
fi

CERT_DIR="$(cd "$(dirname "$0")" && pwd)"
DAYS_VALID=365  # 1 year

# Verify root CA exists
if [ ! -f "$CERT_DIR/root-ca.key" ] || [ ! -f "$CERT_DIR/root-ca.crt" ]; then
  echo "❌ Error: Root CA certificate not found!"
  echo "   Run ./generate-root-ca.sh first"
  exit 1
fi

echo "🔐 Generating device certificate for: $DEVICE_ID"
echo ""

# Generate device private key
echo "📝 Step 1: Generating device private key..."
openssl genrsa -out "$CERT_DIR/$DEVICE_ID.key" 2048
chmod 600 "$CERT_DIR/$DEVICE_ID.key"
echo "   ✅ $DEVICE_ID.key created (2048-bit RSA)"

# Generate certificate signing request (CSR)
echo ""
echo "📝 Step 2: Generating certificate signing request..."
openssl req -new \
  -key "$CERT_DIR/$DEVICE_ID.key" \
  -out "$CERT_DIR/$DEVICE_ID.csr" \
  -subj "/C=US/ST=Texas/L=Midland/O=WellPulse/OU=IoT Devices/CN=$DEVICE_ID"
echo "   ✅ $DEVICE_ID.csr created"

# Sign device certificate with root CA
echo ""
echo "📝 Step 3: Signing device certificate with root CA..."
openssl x509 -req \
  -in "$CERT_DIR/$DEVICE_ID.csr" \
  -CA "$CERT_DIR/root-ca.crt" \
  -CAkey "$CERT_DIR/root-ca.key" \
  -CAcreateserial \
  -out "$CERT_DIR/$DEVICE_ID.crt" \
  -days $DAYS_VALID \
  -sha256
echo "   ✅ $DEVICE_ID.crt created (valid for 1 year)"

# Create certificate chain
echo ""
echo "📝 Step 4: Creating certificate chain..."
cat "$CERT_DIR/$DEVICE_ID.crt" "$CERT_DIR/root-ca.crt" > "$CERT_DIR/$DEVICE_ID-chain.crt"
echo "   ✅ $DEVICE_ID-chain.crt created"

# Cleanup CSR
rm "$CERT_DIR/$DEVICE_ID.csr"

# Display certificate details
echo ""
echo "📋 Device Certificate Details:"
openssl x509 -in "$CERT_DIR/$DEVICE_ID.crt" -text -noout | grep -E "(Subject:|Not Before|Not After)"

echo ""
echo "✅ Device certificate generated successfully!"
echo ""
echo "📦 Generated Files:"
echo "   - $DEVICE_ID.key (private key - KEEP SECURE)"
echo "   - $DEVICE_ID.crt (device certificate)"
echo "   - $DEVICE_ID-chain.crt (certificate chain)"
echo ""

if [ "$RENEW_MODE" = true ]; then
  echo "🔄 Renewal mode detected - update IoT Edge configuration:"
  echo "   sudo nano /etc/aziot/config.toml"
  echo "   sudo iotedge config apply"
else
  echo "📤 Next Steps:"
  echo "   1. Copy certificate and key to gateway device:"
  echo "      scp $DEVICE_ID-chain.crt root@<gateway-ip>:/etc/iot-edge/certs/"
  echo "      scp $DEVICE_ID.key root@<gateway-ip>:/etc/iot-edge/certs/"
  echo ""
  echo "   2. Register device in Azure IoT Hub:"
  echo "      az iot hub device-identity create \\"
  echo "        --hub-name iothub-wellpulse-<tenant>-prod \\"
  echo "        --device-id $DEVICE_ID \\"
  echo "        --edge-enabled \\"
  echo "        --auth-method x509_ca"
  echo ""
  echo "   3. Configure IoT Edge on gateway device:"
  echo "      sudo nano /etc/aziot/config.toml"
  echo "      sudo iotedge config apply"
fi
echo ""
