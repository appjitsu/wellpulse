// WellPulse Azure IoT Hub Infrastructure
// Provisions IoT Hub + Event Grid for SCADA integration

targetScope = 'subscription'

// Parameters
@description('Environment name (dev, staging, production)')
param environment string

@description('Azure region for resources')
param location string = 'eastus'

@description('Tenant subdomain (e.g., acmeoil)')
param tenantSubdomain string

@description('API webhook URL for Event Grid delivery')
param apiWebhookUrl string

@description('IoT Hub SKU (S1 recommended)')
@allowed(['S1', 'S2', 'S3'])
param iotHubSku string = 'S1'

@description('IoT Hub capacity (scale units)')
@minValue(1)
@maxValue(10)
param iotHubCapacity int = 1

@description('Resource tags')
param tags object = {
  Project: 'WellPulse'
  ManagedBy: 'Bicep'
}

// Variables
var resourceGroupName = 'rg-wellpulse-${tenantSubdomain}-${environment}'
var iotHubName = 'iothub-wellpulse-${tenantSubdomain}-${environment}'
var eventGridTopicName = 'evgt-wellpulse-scada-${tenantSubdomain}-${environment}'
var eventGridSubscriptionName = 'webhook-to-api'

// Resource Group
resource resourceGroup 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: resourceGroupName
  location: location
  tags: union(tags, {
    Tenant: tenantSubdomain
    Environment: environment
  })
}

// IoT Hub
module iotHub 'modules/iot-hub.bicep' = {
  scope: resourceGroup
  name: 'deploy-iot-hub'
  params: {
    name: iotHubName
    location: location
    sku: iotHubSku
    capacity: iotHubCapacity
    tags: union(tags, {
      Tenant: tenantSubdomain
      Environment: environment
    })
  }
}

// Event Grid Topic
module eventGridTopic 'modules/event-grid.bicep' = {
  scope: resourceGroup
  name: 'deploy-event-grid'
  params: {
    topicName: eventGridTopicName
    location: location
    tags: union(tags, {
      Tenant: tenantSubdomain
      Environment: environment
    })
  }
}

// Event Grid Subscription (IoT Hub → Event Grid → Webhook)
module eventGridSubscription 'modules/event-subscription.bicep' = {
  scope: resourceGroup
  name: 'deploy-event-subscription'
  params: {
    subscriptionName: eventGridSubscriptionName
    topicName: eventGridTopicName
    webhookUrl: apiWebhookUrl
  }
  dependsOn: [
    eventGridTopic
    iotHub
  ]
}

// Outputs
output resourceGroupName string = resourceGroupName
output iotHubName string = iotHubName
output iotHubHostname string = iotHub.outputs.hostname
output iotHubResourceId string = iotHub.outputs.resourceId
output iotHubPrincipalId string = iotHub.outputs.principalId
output eventGridTopicName string = eventGridTopicName
output eventGridTopicEndpoint string = eventGridTopic.outputs.endpoint

// Development-only output (SECRETS - commented out for production)
// Uncomment for local development only
// output iotHubConnectionString string = iotHub.outputs.connectionString
