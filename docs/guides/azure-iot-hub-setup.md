# Azure IoT Hub Setup Guide for SCADA Integration

**Version**: 1.0
**Last Updated**: October 29, 2025
**Purpose**: Provision Azure IoT Hub + Event Grid infrastructure for WellPulse SCADA integration

---

## Overview

This guide walks through provisioning Azure infrastructure for hybrid cloud SCADA integration using **Infrastructure as Code (Bicep)**.

**Architecture Components**:
- **Azure IoT Hub**: Device management and messaging hub for RTU/PLC gateways
- **Azure Event Grid**: Event-driven message routing to WellPulse API webhooks
- **Azure Container Apps**: Existing WellPulse API (webhook endpoint)
- **IoT Edge Gateway**: On-premises edge runtime at well sites (Linux/Windows device)

**Cost Estimate**:
- Small operator (10 wells, 1 gateway): ~$27/month
- Medium operator (50 wells, 5 gateways): ~$55/month

---

## Prerequisites

### 1. Azure Subscription & CLI

```bash
# Install Azure CLI (macOS)
brew install azure-cli

# Login to Azure
az login

# Set subscription (if multiple subscriptions)
az account set --subscription "YOUR_SUBSCRIPTION_ID"

# Verify current subscription
az account show
```

### 2. Required Permissions

You need **Contributor** or **Owner** role on the Azure subscription to provision:
- Resource Groups
- IoT Hub
- Event Grid Topics
- Event Grid Subscriptions

### 3. Install Bicep CLI

```bash
# Bicep is included with Azure CLI 2.20.0+
az bicep version

# If not installed, upgrade Azure CLI
az upgrade
```

---

## Step 1: Clone Infrastructure Repository

```bash
cd /Users/jason/projects/wellpulse

# Infrastructure as Code files will be in:
# infrastructure/azure/iot-hub/
```

---

## Step 2: Configure Deployment Parameters

Edit `infrastructure/azure/iot-hub/parameters.json`:

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "environment": {
      "value": "production"  // or "staging", "dev"
    },
    "location": {
      "value": "eastus"  // Azure region closest to Permian Basin
    },
    "tenantSubdomain": {
      "value": "acmeoil"  // Client subdomain (e.g., acmeoil.wellpulse.io)
    },
    "apiWebhookUrl": {
      "value": "https://acmeoil.wellpulse.io/api/webhooks/scada"
    },
    "iotHubSku": {
      "value": "S1"  // S1 = $25/month (400K messages/day)
    },
    "iotHubCapacity": {
      "value": 1  // Scale units (1-10)
    },
    "tags": {
      "value": {
        "Project": "WellPulse",
        "Tenant": "acmeoil",
        "Environment": "production",
        "CostCenter": "IT",
        "ManagedBy": "Bicep"
      }
    }
  }
}
```

**Key Parameters**:
- `tenantSubdomain`: Client's subdomain (isolates IoT Hub per tenant)
- `apiWebhookUrl`: Webhook endpoint on WellPulse API (Container Apps)
- `iotHubSku`: S1 tier recommended (Basic tier lacks Event Grid integration)

---

## Step 3: Deploy Infrastructure (Bicep)

### 3A. Validate Bicep Template

```bash
cd infrastructure/azure/iot-hub

# Validate template syntax
az bicep build --file main.bicep

# What-if deployment (preview changes without applying)
az deployment sub what-if \
  --template-file main.bicep \
  --parameters parameters.json \
  --location eastus
```

### 3B. Deploy to Azure

```bash
# Create deployment
az deployment sub create \
  --name wellpulse-iot-hub-$(date +%Y%m%d-%H%M%S) \
  --template-file main.bicep \
  --parameters parameters.json \
  --location eastus

# Expected output:
# ✅ Resource Group: rg-wellpulse-acmeoil-prod
# ✅ IoT Hub: iothub-wellpulse-acmeoil-prod
# ✅ Event Grid Topic: evgt-wellpulse-scada-acmeoil-prod
# ✅ Event Grid Subscription: webhook-to-api
```

**Deployment Time**: ~5-10 minutes

### 3C. Verify Deployment

```bash
# Get resource group name
RG_NAME="rg-wellpulse-acmeoil-prod"

# List all resources in resource group
az resource list --resource-group $RG_NAME --output table

# Get IoT Hub details
az iot hub show --name iothub-wellpulse-acmeoil-prod --query "{name:name,sku:sku,state:properties.state}"

# Get Event Grid topic endpoint
az eventgrid topic show --name evgt-wellpulse-scada-acmeoil-prod --resource-group $RG_NAME --query endpoint
```

---

## Step 4: Generate X.509 Certificates for Device Authentication

Azure IoT Hub uses **X.509 certificates** for device authentication (no passwords).

### 4A. Generate Root CA Certificate (One-time Setup)

```bash
cd infrastructure/azure/iot-hub/certificates

# Run certificate generation script
./generate-root-ca.sh

# Output:
# ├── root-ca.key         (KEEP SECURE - private key)
# ├── root-ca.crt         (Upload to Azure IoT Hub)
# └── root-ca-verification.crt  (For Azure verification)
```

### 4B. Upload Root CA to Azure IoT Hub

```bash
# Upload root CA certificate
az iot hub certificate create \
  --hub-name iothub-wellpulse-acmeoil-prod \
  --name wellpulse-root-ca \
  --path ./certificates/root-ca.crt

# Azure will provide a verification code
# Generate verification certificate
./generate-verification-cert.sh <VERIFICATION_CODE>

# Verify root CA ownership
az iot hub certificate verify \
  --hub-name iothub-wellpulse-acmeoil-prod \
  --name wellpulse-root-ca \
  --path ./certificates/root-ca-verification.crt
```

### 4C. Generate Device Certificates (Per Gateway)

```bash
# Generate certificate for well site gateway
./generate-device-cert.sh "gateway-acme-well-001"

# Output:
# ├── gateway-acme-well-001.key
# ├── gateway-acme-well-001.crt
# └── gateway-acme-well-001-chain.crt  (includes root CA)

# Copy to gateway device (secure transfer)
scp gateway-acme-well-001-chain.crt root@well-gateway-ip:/etc/iot-edge/certs/
scp gateway-acme-well-001.key root@well-gateway-ip:/etc/iot-edge/certs/
```

---

## Step 5: Register IoT Edge Devices

### 5A. Register Device in IoT Hub

```bash
# Register new IoT Edge device
az iot hub device-identity create \
  --hub-name iothub-wellpulse-acmeoil-prod \
  --device-id gateway-acme-well-001 \
  --edge-enabled \
  --auth-method x509_ca

# Verify device registered
az iot hub device-identity list \
  --hub-name iothub-wellpulse-acmeoil-prod \
  --output table
```

### 5B. Get IoT Hub Connection Details

```bash
# Get IoT Hub hostname (needed for gateway configuration)
az iot hub show \
  --name iothub-wellpulse-acmeoil-prod \
  --query properties.hostName \
  --output tsv

# Output: iothub-wellpulse-acmeoil-prod.azure-devices.net
```

---

## Step 6: Configure IoT Edge Gateway (On-Premises Device)

### 6A. Install IoT Edge Runtime on Well Site Device

**Supported Platforms**:
- Ubuntu 22.04 LTS (recommended)
- Debian 11/12
- Red Hat Enterprise Linux 8/9
- Windows Server 2019/2022

**Installation (Ubuntu)**:

```bash
# SSH into well site gateway
ssh wellpulse@well-gateway-ip

# Install IoT Edge runtime
curl https://packages.microsoft.com/config/ubuntu/22.04/packages-microsoft-prod.deb > packages-microsoft-prod.deb
sudo dpkg -i packages-microsoft-prod.deb
sudo apt-get update
sudo apt-get install -y aziot-edge

# Verify installation
iotedge --version
```

### 6B. Configure IoT Edge with X.509 Certificate

Edit `/etc/aziot/config.toml`:

```toml
# Provisioning configuration
[provisioning]
source = "manual"
iothub_hostname = "iothub-wellpulse-acmeoil-prod.azure-devices.net"
device_id = "gateway-acme-well-001"

# Authentication with X.509 certificate
[provisioning.authentication]
method = "x509"

# Device certificate and key
identity_cert = "file:///etc/iot-edge/certs/gateway-acme-well-001.crt"
identity_pk = "file:///etc/iot-edge/certs/gateway-acme-well-001.key"

# Edge Agent configuration
[agent]
name = "edgeAgent"
type = "docker"

[agent.config]
image = "mcr.microsoft.com/azureiotedge-agent:1.4"

# Hostname
hostname = "gateway-acme-well-001"
```

### 6C. Apply Configuration and Start IoT Edge

```bash
# Apply configuration
sudo iotedge config apply

# Check IoT Edge status
sudo iotedge system status

# Verify connection to IoT Hub
sudo iotedge check

# View logs
sudo iotedge logs edgeAgent
```

**Expected Output**:
```
✅ IoT Edge daemon is running
✅ Connected to IoT Hub
✅ EdgeAgent module is running
```

---

## Step 7: Deploy SCADA Connector Module to IoT Edge

### 7A. Create IoT Edge Deployment Manifest

Create `deployment.acmeoil.json`:

```json
{
  "modulesContent": {
    "$edgeAgent": {
      "properties.desired": {
        "schemaVersion": "1.1",
        "runtime": {
          "type": "docker",
          "settings": {
            "minDockerVersion": "v1.25",
            "loggingOptions": "",
            "registryCredentials": {}
          }
        },
        "systemModules": {
          "edgeAgent": {
            "type": "docker",
            "settings": {
              "image": "mcr.microsoft.com/azureiotedge-agent:1.4",
              "createOptions": {}
            }
          },
          "edgeHub": {
            "type": "docker",
            "status": "running",
            "restartPolicy": "always",
            "settings": {
              "image": "mcr.microsoft.com/azureiotedge-hub:1.4",
              "createOptions": {
                "HostConfig": {
                  "PortBindings": {
                    "5671/tcp": [{"HostPort": "5671"}],
                    "8883/tcp": [{"HostPort": "8883"}],
                    "443/tcp": [{"HostPort": "443"}]
                  }
                }
              }
            }
          }
        },
        "modules": {
          "scadaConnector": {
            "version": "1.0",
            "type": "docker",
            "status": "running",
            "restartPolicy": "always",
            "settings": {
              "image": "wellpulse.azurecr.io/scada-connector:latest",
              "createOptions": {
                "HostConfig": {
                  "NetworkMode": "host"
                },
                "Env": [
                  "OPC_UA_ENDPOINT=opc.tcp://192.168.1.100:4840",
                  "POLL_INTERVAL_MS=5000",
                  "TENANT_ID=acmeoil"
                ]
              }
            }
          }
        }
      }
    },
    "$edgeHub": {
      "properties.desired": {
        "schemaVersion": "1.1",
        "routes": {
          "scadaToIoTHub": "FROM /messages/modules/scadaConnector/* INTO $upstream"
        },
        "storeAndForwardConfiguration": {
          "timeToLiveSecs": 86400
        }
      }
    },
    "scadaConnector": {
      "properties.desired": {
        "opcUaEndpoint": "opc.tcp://192.168.1.100:4840",
        "tags": [
          {"nodeId": "ns=2;s=Pressure", "tagName": "casingPressure", "unit": "psi"},
          {"nodeId": "ns=2;s=Temperature", "tagName": "temperature", "unit": "F"},
          {"nodeId": "ns=2;s=FlowRate", "tagName": "flowRate", "unit": "bbl/day"}
        ],
        "pollIntervalMs": 5000
      }
    }
  }
}
```

### 7B. Deploy Module to Device

```bash
# Apply deployment manifest
az iot edge set-modules \
  --hub-name iothub-wellpulse-acmeoil-prod \
  --device-id gateway-acme-well-001 \
  --content deployment.acmeoil.json

# Verify module deployed
az iot hub module-identity list \
  --hub-name iothub-wellpulse-acmeoil-prod \
  --device-id gateway-acme-well-001 \
  --output table
```

### 7C. Monitor Module Logs

```bash
# SSH into gateway
ssh wellpulse@well-gateway-ip

# View SCADA connector logs
sudo iotedge logs scadaConnector --tail 100 --follow

# Expected output:
# [INFO] OPC-UA client connected to opc.tcp://192.168.1.100:4840
# [INFO] Reading tag: ns=2;s=Pressure -> 1250.5 psi
# [INFO] Sending message to IoT Hub (batch: 3 readings)
```

---

## Step 8: Configure WellPulse API Webhook Handler

### 8A. Create SCADA Webhook Endpoint

The webhook endpoint was already specified in the Event Grid subscription during Bicep deployment.

**URL**: `https://acmeoil.wellpulse.io/api/webhooks/scada`

### 8B. Implement Webhook Handler (NestJS)

The webhook handler will be implemented in Sprint 5 with:
- Event Grid event validation
- SCADA reading deserialization
- Field entry creation
- Nominal range violation checks
- Alert generation

**Route**: `POST /webhooks/scada`

---

## Step 9: Testing End-to-End Flow

### 9A. Send Test Message from Gateway

```bash
# SSH into gateway
ssh wellpulse@well-gateway-ip

# Send test message using IoT Edge CLI
sudo iotedge message send \
  --module scadaConnector \
  --data '{"wellId":"WELL-001","readings":[{"tagName":"casingPressure","value":1250.5,"unit":"psi","timestamp":"2025-10-29T12:00:00Z"}]}'
```

### 9B. Monitor Event Grid Delivery

```bash
# Check Event Grid metrics in Azure Portal
az monitor metrics list \
  --resource "/subscriptions/{sub-id}/resourceGroups/rg-wellpulse-acmeoil-prod/providers/Microsoft.EventGrid/topics/evgt-wellpulse-scada-acmeoil-prod" \
  --metric "PublishSuccessCount" \
  --start-time 2025-10-29T00:00:00Z \
  --end-time 2025-10-29T23:59:59Z

# Check webhook delivery success
az eventgrid event-subscription show \
  --name webhook-to-api \
  --source-resource-id "/subscriptions/{sub-id}/resourceGroups/rg-wellpulse-acmeoil-prod/providers/Microsoft.EventGrid/topics/evgt-wellpulse-scada-acmeoil-prod" \
  --query "deliveryWithResourceIdentity.destination"
```

### 9C. Verify Data in WellPulse Dashboard

```bash
# Query field entries API
curl -X GET "https://acmeoil.wellpulse.io/api/field-data/entries?source=scada" \
  -H "Authorization: Bearer {jwt_token}"

# Expected response:
# {
#   "data": [
#     {
#       "id": "uuid",
#       "wellId": "WELL-001",
#       "casingPressure": 1250.5,
#       "timestamp": "2025-10-29T12:00:00Z",
#       "source": "scada",
#       "createdBy": "system"
#     }
#   ]
# }
```

---

## Step 10: Production Hardening

### 10A. Enable IoT Hub Monitoring

```bash
# Enable Azure Monitor diagnostics
az monitor diagnostic-settings create \
  --resource "/subscriptions/{sub-id}/resourceGroups/rg-wellpulse-acmeoil-prod/providers/Microsoft.Devices/IotHubs/iothub-wellpulse-acmeoil-prod" \
  --name iot-hub-diagnostics \
  --logs '[{"category":"Connections","enabled":true},{"category":"DeviceTelemetry","enabled":true}]' \
  --metrics '[{"category":"AllMetrics","enabled":true}]' \
  --workspace "/subscriptions/{sub-id}/resourceGroups/rg-wellpulse-acmeoil-prod/providers/Microsoft.OperationalInsights/workspaces/log-analytics-wellpulse"
```

### 10B. Set Up Alerts

```bash
# Alert on device disconnection
az monitor metrics alert create \
  --name "IoT-Device-Disconnected" \
  --resource-group rg-wellpulse-acmeoil-prod \
  --scopes "/subscriptions/{sub-id}/resourceGroups/rg-wellpulse-acmeoil-prod/providers/Microsoft.Devices/IotHubs/iothub-wellpulse-acmeoil-prod" \
  --condition "avg ConnectedDeviceCount < 1" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action "/subscriptions/{sub-id}/resourceGroups/rg-wellpulse-acmeoil-prod/providers/Microsoft.Insights/actionGroups/wellpulse-alerts"
```

### 10C. Configure IoT Hub Retention Policy

```bash
# Set message retention to 7 days (max for S1 tier)
az iot hub update \
  --name iothub-wellpulse-acmeoil-prod \
  --set properties.messagingEndpoints.events.retentionTimeInDays=7
```

---

## Troubleshooting

### Issue: Device Not Connecting to IoT Hub

**Symptoms**: `sudo iotedge check` shows connection failures

**Solutions**:
1. Verify certificate validity: `openssl x509 -in gateway-acme-well-001.crt -text -noout`
2. Check firewall rules allow AMQP (5671) and MQTT (8883)
3. Verify DNS resolution: `nslookup iothub-wellpulse-acmeoil-prod.azure-devices.net`
4. Check IoT Edge logs: `sudo journalctl -u aziot-edged -f`

### Issue: Event Grid Not Delivering to Webhook

**Symptoms**: Messages sent from gateway but not received by API

**Solutions**:
1. Verify webhook endpoint is publicly accessible (Event Grid requires public endpoint)
2. Check Event Grid subscription status: `az eventgrid event-subscription show`
3. View failed deliveries in Azure Portal → Event Grid Topic → Metrics → "Delivery Failed Events"
4. Ensure webhook handler returns `200 OK` within 60 seconds

### Issue: OPC-UA Connection Refused

**Symptoms**: SCADA connector logs show "Connection refused" to RTU/PLC

**Solutions**:
1. Verify OPC-UA server is running on RTU/PLC
2. Check network connectivity: `ping 192.168.1.100`
3. Test OPC-UA endpoint: `opcua-client read opc.tcp://192.168.1.100:4840 "ns=2;s=Pressure"`
4. Ensure gateway has network access to RTU (same VLAN or routing configured)

---

## Cost Optimization

### Right-Sizing IoT Hub

| Tier | Messages/Day | Cost/Month | Use Case |
|------|--------------|------------|----------|
| **B1** (Basic) | 400K | $10 | Development only (no Event Grid) |
| **S1** (Standard) | 400K | $25 | Small operators (1-10 wells) ✅ |
| **S2** (Standard) | 6M | $250 | Medium operators (50-100 wells) |
| **S3** (Standard) | 300M | $2,500 | Large operators (500+ wells) |

**Calculation Example** (Small Operator):
- 10 wells × 3 tags/well × 12 readings/hour × 24 hours = 8,640 messages/day
- S1 tier supports 400K messages/day → Sufficient for 460+ wells
- **Recommendation**: Start with S1 tier, scale to S2 when exceeding 100 wells

### Event Grid Cost Optimization

- **First 100K operations/month**: Free
- **Next 100K-10M operations/month**: $0.60 per million operations
- **Expected Cost**: $2-5/month for most operators

---

## Security Best Practices

### 1. Rotate X.509 Certificates Annually

```bash
# Generate new device certificate
./generate-device-cert.sh "gateway-acme-well-001" --renew

# Update IoT Edge configuration
sudo nano /etc/aziot/config.toml

# Apply configuration
sudo iotedge config apply
```

### 2. Restrict Network Access

- Configure Azure Firewall or Network Security Groups
- Whitelist only WellPulse API IP ranges for webhook delivery
- Use private endpoints for IoT Hub (eliminate public internet exposure)

### 3. Enable Azure Security Center

```bash
# Enable Microsoft Defender for IoT
az security pricing create \
  --name IoT \
  --tier Standard
```

---

## Next Steps

1. ✅ **Infrastructure Provisioned**: Azure IoT Hub + Event Grid deployed via Bicep
2. ✅ **Device Registered**: IoT Edge gateway registered with X.509 authentication
3. ✅ **Module Deployed**: SCADA connector module deployed to gateway
4. ⏳ **API Implementation**: Implement webhook handler in WellPulse API (Sprint 5)
5. ⏳ **UI Implementation**: Build SCADA management UI in dashboard (Sprint 5)
6. ⏳ **Testing**: End-to-end integration testing with real RTU/PLC

---

## Additional Resources

- **Azure IoT Hub Documentation**: https://docs.microsoft.com/azure/iot-hub/
- **Azure IoT Edge Documentation**: https://docs.microsoft.com/azure/iot-edge/
- **Azure Event Grid Documentation**: https://docs.microsoft.com/azure/event-grid/
- **OPC Foundation**: https://opcfoundation.org/
- **node-opcua Library**: https://node-opcua.github.io/
