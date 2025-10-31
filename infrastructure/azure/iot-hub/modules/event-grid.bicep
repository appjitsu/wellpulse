// Event Grid Topic Module

param topicName string
param location string
param tags object

resource eventGridTopic 'Microsoft.EventGrid/topics@2023-12-15-preview' = {
  name: topicName
  location: location
  tags: tags
  properties: {
    inputSchema: 'EventGridSchema'
    publicNetworkAccess: 'Enabled'
  }
}

output endpoint string = eventGridTopic.properties.endpoint
output resourceId string = eventGridTopic.id
output name string = eventGridTopic.name
