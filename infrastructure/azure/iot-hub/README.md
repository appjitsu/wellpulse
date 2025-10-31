# Azure IoT Hub Infrastructure

**Purpose**: Infrastructure as Code (Bicep) for provisioning Azure IoT Hub + Event Grid for WellPulse SCADA integration.

---

## Quick Start

### 1. Prerequisites

- Azure CLI installed (`brew install azure-cli`)
- Azure subscription with Contributor/Owner permissions
- Logged in to Azure (`az login`)

### 2. Configure Parameters

Edit `parameters.json` to customize for your tenant:

```json
{
  "environment": "production",
  "tenantSubdomain": "acmeoil",
  "apiWebhookUrl": "https://acmeoil.wellpulse.io/api/webhooks/scada",
  "iotHubSku": "S1"
}
```

### 3. Deploy Infrastructure

```bash
# Validate template
az bicep build --file main.bicep

# Deploy to Azure
az deployment sub create \
  --name wellpulse-iot-hub-$(date +%Y%m%d-%H%M%S) \
  --template-file main.bicep \
  --parameters parameters.json \
  --location eastus
```

### 4. Generate Certificates

```bash
cd certificates

# Generate root CA (one-time)
./generate-root-ca.sh

# Upload to Azure IoT Hub
az iot hub certificate create \
  --hub-name iothub-wellpulse-acmeoil-prod \
  --name wellpulse-root-ca \
  --path ./root-ca.crt

# Generate verification certificate (Azure provides code)
./generate-verification-cert.sh <VERIFICATION_CODE>

# Verify ownership
az iot hub certificate verify \
  --hub-name iothub-wellpulse-acmeoil-prod \
  --name wellpulse-root-ca \
  --path ./root-ca-verification.crt

# Generate device certificate
./generate-device-cert.sh gateway-acme-well-001
```

### 5. Register Device

```bash
az iot hub device-identity create \
  --hub-name iothub-wellpulse-acmeoil-prod \
  --device-id gateway-acme-well-001 \
  --edge-enabled \
  --auth-method x509_ca
```

### 6. Deploy IoT Edge Module

```bash
# Customize deployment manifest
cp deployment.template.json deployment.acmeoil.json
# Edit OPC-UA endpoint, tenant ID, etc.

# Deploy to device
az iot edge set-modules \
  --hub-name iothub-wellpulse-acmeoil-prod \
  --device-id gateway-acme-well-001 \
  --content deployment.acmeoil.json
```

---

## File Structure

```
infrastructure/azure/iot-hub/
├── main.bicep                      # Main Bicep template (orchestrator)
├── parameters.json                 # Deployment parameters
├── deployment.template.json        # IoT Edge module deployment manifest
├── modules/
│   ├── iot-hub.bicep              # IoT Hub resource definition
│   ├── event-grid.bicep           # Event Grid topic definition
│   └── event-subscription.bicep   # Event Grid subscription (webhook)
└── certificates/
    ├── generate-root-ca.sh        # Generate root CA certificate
    ├── generate-device-cert.sh    # Generate device certificate
    └── generate-verification-cert.sh # Generate verification certificate
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                Remote Well Site (On-Premises)                    │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    OPC-UA/Modbus  ┌────────────────────┐     │
│  │  RTU/PLC     │ ←─────────────→  │  IoT Edge Gateway  │     │
│  │ (OPC Server) │   node-opcua      │  (scadaConnector)  │     │
│  └──────────────┘                    └────────────────────┘     │
│                                               │ MQTT/AMQPS       │
└───────────────────────────────────────────────┼──────────────────┘
                                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                         Azure Cloud                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────┐    │
│  │                   Azure IoT Hub (S1)                    │    │
│  │  - Device Authentication (X.509 certificates)          │    │
│  │  - Message Routing & Filtering                         │    │
│  │  - Offline Message Queue (7-day retention)             │    │
│  └────────────────────┬───────────────────────────────────┘    │
│                       ↓                                          │
│  ┌────────────────────────────────────────────────────────┐    │
│  │            Azure Event Grid Topic                       │    │
│  │  - Event-driven message delivery                       │    │
│  │  - Retry policy: 30 attempts, 24-hour TTL              │    │
│  └────────────────────┬───────────────────────────────────┘    │
│                       ↓ Webhook                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │       WellPulse API (Azure Container Apps)             │    │
│  │  POST /webhooks/scada                                  │    │
│  └─────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Resources Provisioned

| Resource Type | Name Pattern | SKU | Purpose |
|---------------|-------------|-----|---------|
| **Resource Group** | `rg-wellpulse-{tenant}-{env}` | N/A | Logical grouping |
| **IoT Hub** | `iothub-wellpulse-{tenant}-{env}` | S1 | Device management & messaging |
| **Event Grid Topic** | `evgt-wellpulse-scada-{tenant}-{env}` | Standard | Event routing |
| **Event Grid Subscription** | `webhook-to-api` | N/A | Webhook delivery |

---

## Cost Estimation

### Small Operator (10 wells, 1 gateway)

| Service | SKU | Messages/Day | Cost/Month |
|---------|-----|--------------|------------|
| IoT Hub | S1 | 8,640 | $25.00 |
| Event Grid | Standard | 8,640 | $0.52 |
| **Total** | | | **~$26/month** |

### Medium Operator (50 wells, 5 gateways)

| Service | SKU | Messages/Day | Cost/Month |
|---------|-----|--------------|------------|
| IoT Hub | S1 | 43,200 | $25.00 |
| Event Grid | Standard | 43,200 | $2.59 |
| **Total** | | | **~$28/month** |

**Note**: Container Apps cost is not included (existing infrastructure).

---

## Security

### Authentication
- **X.509 Certificate Authentication**: No passwords, certificate-based device identity
- **Root CA + Device Certificates**: Hierarchical trust chain
- **TLS 1.2 Encryption**: All communication encrypted in transit

### Network Security
- **Private Network Isolation**: RTUs on private well site network
- **Azure Managed Identity**: API webhook access without credentials
- **Audit Trail**: Complete logging via Azure Monitor

### Certificate Rotation
- **Root CA**: Valid for 10 years
- **Device Certificates**: Valid for 1 year, rotate annually
- **Rotation Script**: `./generate-device-cert.sh <device-id> --renew`

---

## Troubleshooting

### IoT Edge Device Not Connecting

```bash
# Check IoT Edge status
sudo iotedge check

# View logs
sudo iotedge logs edgeAgent
sudo journalctl -u aziot-edged -f

# Verify certificate
openssl x509 -in /etc/iot-edge/certs/device.crt -text -noout

# Test DNS
nslookup iothub-wellpulse-acmeoil-prod.azure-devices.net
```

### Event Grid Not Delivering to Webhook

```bash
# Check Event Grid metrics
az monitor metrics list \
  --resource "/subscriptions/{sub-id}/resourceGroups/rg-wellpulse-acmeoil-prod/providers/Microsoft.EventGrid/topics/evgt-wellpulse-scada-acmeoil-prod" \
  --metric "DeliveryFailCount"

# View failed deliveries in Azure Portal
# Event Grid Topic → Metrics → "Delivery Failed Events"
```

---

## Documentation

- **Setup Guide**: `/docs/guides/azure-iot-hub-setup.md`
- **Sprint 5 Specification**: `/docs/sprints/sprint-5-implementation-spec.md`
- **Azure IoT Hub Docs**: https://docs.microsoft.com/azure/iot-hub/
- **Azure Event Grid Docs**: https://docs.microsoft.com/azure/event-grid/

---

## Next Steps

1. ✅ Infrastructure provisioned via Bicep
2. ✅ Certificates generated and uploaded
3. ✅ Device registered in IoT Hub
4. ⏳ Implement SCADA connector module (Sprint 5)
5. ⏳ Implement API webhook handler (Sprint 5)
6. ⏳ Build SCADA management UI (Sprint 5)
