# CNI Step Result Utility - Example Implementation

This document shows how to implement a utility function in your CNI integration to send step results back to the VSCode extension.

## How It Works

1. **Extension starts test** → Creates ephemeral secret and test session
2. **Headers passed to CNI** → `X-Prismatic-Server-URL` and `X-Prismatic-Secret` 
3. **CNI calls utility** → Reads headers and sends step results
4. **Extension persists data** → Saves step results to `.prismatic/executions/{executionId}/`

## Example Utility Function

```typescript
// stepResult.ts - CNI Integration Utility
import { Request } from '@types/node';

interface StepResultData {
  [key: string]: any;
}

/**
 * Send a step result back to the VSCode extension
 * @param stepName - Name of the step (e.g., "webhook-trigger", "data-mapper")  
 * @param data - JSON serializable data to persist
 */
export async function sendStepResult(stepName: string, data: StepResultData): Promise<void> {
  try {
    // Read headers from the execution context
    const serverUrl = process.env.HTTP_HEADER_X_PRISMATIC_SERVER_URL;
    const secret = process.env.HTTP_HEADER_X_PRISMATIC_SECRET;
    const executionId = process.env.EXECUTION_ID; // This would come from Prismatic

    if (!serverUrl || !secret || !executionId) {
      console.log('⚠️  Step result utility not configured (missing headers), skipping');
      return;
    }

    console.log(`📊 Sending step result: ${stepName}`);

    const response = await fetch(`${serverUrl}/api/prismatic/step-result`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secret}`,
        'X-Execution-ID': executionId
      },
      body: JSON.stringify({
        stepName,
        data
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`HTTP ${response.status}: ${errorData.error || 'Unknown error'}`);
    }

    const result = await response.json();
    console.log(`✅ Step result sent successfully: ${result.message}`);

  } catch (error) {
    console.error(`❌ Failed to send step result '${stepName}':`, error);
    // Don't throw - we don't want step result failures to break the integration
  }
}

/**
 * Typed version for better developer experience
 * @param stepName - Name of the step
 * @param data - Typed step result data
 */
export async function sendTypedStepResult<T extends StepResultData>(
  stepName: string, 
  data: T
): Promise<void> {
  return sendStepResult(stepName, data);
}
```

## Usage Examples

```typescript
// In your CNI integration step
import { sendStepResult } from './stepResult';

export const webhookTrigger = async (context) => {
  const payload = context.payload;
  
  // Your step logic here
  const processedData = {
    originalPayload: payload,
    timestamp: new Date().toISOString(),
    headers: context.headers
  };

  // Send the step result to the extension
  await sendStepResult('webhook-trigger', {
    input: payload,
    output: processedData,
    metadata: {
      processingTime: 150,
      status: 'success'
    }
  });

  return processedData;
};

export const dataMapper = async (context) => {
  const inputData = context.stepResults.webhookTrigger;
  
  const mappedData = {
    customerId: inputData.customer?.id,
    orderTotal: inputData.order?.total,
    // ... mapping logic
  };

  // Send mapped data
  await sendStepResult('data-mapper', {
    inputSchema: Object.keys(inputData),
    outputSchema: Object.keys(mappedData),
    mapping: mappedData,
    transformations: ['customer.id -> customerId', 'order.total -> orderTotal']
  });

  return mappedData;
};
```

## Generated File Structure

After running a test, your `.prismatic` directory will contain:

```
.prismatic/
└── executions/
    └── SW5zdGFuY2VFeGVjdXRpb25SZXN1bHQ6MTA2NjU2MQ/
        ├── step-webhook-trigger.json
        ├── step-data-mapper.json
        ├── step-api-call.json
        └── step-results-summary.json
```

### Example Step Result File

```json
// step-webhook-trigger.json
{
  "stepName": "webhook-trigger",
  "data": {
    "input": {
      "customer": { "id": "123", "name": "John Doe" },
      "order": { "id": "456", "total": 99.99 }
    },
    "output": {
      "originalPayload": "...",
      "timestamp": "2025-01-15T10:30:00Z",
      "headers": { "content-type": "application/json" }
    },
    "metadata": {
      "processingTime": 150,
      "status": "success"
    }
  },
  "timestamp": "2025-01-15T10:30:00.123Z",
  "receivedAt": 1642248600123
}
```

### Summary File

```json
// step-results-summary.json
{
  "executionId": "SW5zdGFuY2VFeGVjdXRpb25SZXN1bHQ6MTA2NjU2MQ",
  "stepCount": 3,
  "stepNames": ["webhook-trigger", "data-mapper", "api-call"],
  "savedAt": "2025-01-15T10:30:05Z",
  "source": "cni-step-results"
}
```

## API Endpoint Reference

**POST** `/api/prismatic/step-result`

**Headers:**
- `Content-Type: application/json`
- `Authorization: Bearer {ephemeral-secret}`
- `X-Execution-ID: {execution-id}`

**Body:**
```json
{
  "stepName": "my-step-name",
  "data": {
    "input": {},
    "output": {},
    "metadata": {}
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Step result 'my-step-name' recorded",
  "executionId": "SW5zdGFuY2VFeGVjdXRpb25SZXN1bHQ6MTA2NjU2MQ",
  "stepName": "my-step-name"
}
```

## Security Notes

- **Ephemeral secrets** are generated per test execution and expire after 1 hour
- **Automatic cleanup** removes old test sessions
- **Port forwarding** works across local, SSH, containers, and Codespaces
- **Error handling** in utility function prevents integration failures