// Event Grid Subscription Module (IoT Hub → Webhook)

param subscriptionName string
param topicName string

@secure()
@description('Webhook endpoint URL (may contain authentication tokens)')
param webhookUrl string

resource eventGridTopic 'Microsoft.EventGrid/topics@2023-12-15-preview' existing = {
  name: topicName
}

resource eventSubscription 'Microsoft.EventGrid/eventSubscriptions@2023-12-15-preview' = {
  name: subscriptionName
  scope: eventGridTopic
  properties: {
    destination: {
      endpointType: 'WebHook'
      properties: {
        endpointUrl: webhookUrl
        maxEventsPerBatch: 10
        preferredBatchSizeInKilobytes: 64
      }
    }
    filter: {
      includedEventTypes: [
        'Microsoft.Devices.DeviceTelemetry'
        'Microsoft.Devices.DeviceConnected'
        'Microsoft.Devices.DeviceDisconnected'
      ]
      advancedFilters: []
    }
    eventDeliverySchema: 'EventGridSchema'
    retryPolicy: {
      maxDeliveryAttempts: 30
      eventTimeToLiveInMinutes: 1440 // 24 hours
    }
  }
}

output subscriptionId string = eventSubscription.id
output subscriptionName string = eventSubscription.name
