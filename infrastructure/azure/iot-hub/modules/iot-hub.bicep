// IoT Hub Module

param name string
param location string
param sku string
param capacity int
param tags object

resource iotHub 'Microsoft.Devices/IotHubs@2023-06-30' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: sku
    capacity: capacity
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    eventHubEndpoints: {
      events: {
        retentionTimeInDays: 7
        partitionCount: 4
      }
    }
    cloudToDevice: {
      maxDeliveryCount: 10
      defaultTtlAsIso8601: 'PT1H'
      feedback: {
        lockDurationAsIso8601: 'PT1M'
        ttlAsIso8601: 'PT1H'
        maxDeliveryCount: 10
      }
    }
    messagingEndpoints: {
      fileNotifications: {
        lockDurationAsIso8601: 'PT1M'
        ttlAsIso8601: 'PT1H'
        maxDeliveryCount: 10
      }
    }
    enableFileUploadNotifications: false
    routing: {
      endpoints: {
        serviceBusQueues: []
        serviceBusTopics: []
        eventHubs: []
        storageContainers: []
      }
      routes: []
      fallbackRoute: {
        name: '$fallback'
        source: 'DeviceMessages'
        condition: 'true'
        endpointNames: [
          'events'
        ]
        isEnabled: true
      }
    }
    minTlsVersion: '1.2'
    features: 'None'
  }
}

// Production outputs (no secrets)
@description('IoT Hub hostname for managed identity authentication')
output hostname string = iotHub.properties.hostName

@description('Resource ID for RBAC assignments and monitoring')
output resourceId string = iotHub.id

@description('Managed identity principal ID for role assignments')
output principalId string = iotHub.identity.principalId

// Development-only output (contains secrets)
// WARNING: Uncomment only for local development - DO NOT USE IN PRODUCTION
// Production deployments should use Azure Managed Identity authentication
// See: docs/patterns/81-Azure-Infrastructure-Security-Pattern.md
//
// @description('Connection string for development (CONTAINS SECRETS - DO NOT USE IN PRODUCTION)')
// output connectionString string = 'HostName=${iotHub.properties.hostName};SharedAccessKeyName=iothubowner;SharedAccessKey=${iotHub.listKeys().value[0].primaryKey}'
