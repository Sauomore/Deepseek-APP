# Lists Models

Lists the currently available models, and provides metadata about each one, such as its display name, context window, output limit, supported input/output modalities, supported effort levels, and per-protocol API capabilities. Check [Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing.md) for our currently supported models.

## Endpoint

```http
GET /models
```

operationId: `listModels`

### Servers

- `https://api.deepseek.com`

## Authentication

### Alternative 1

**bearerAuth**

`Authorization: Bearer <API_KEY>`

```yaml
type: http
scheme: bearer
```

## Responses

### 200

OK, returns A list of models

#### application/json

- Reference: [ListModelsResponse](#schema-list-models-response) (`#/components/schemas/ListModelsResponse`)

**Example**

```json
{
  "object": "list",
  "data": [
    {
      "id": "deepseek-flash",
      "object": "model",
      "owned_by": "deepseek",
      "name": "DeepSeek-V4.1-Flash",
      "context_window": 1048576,
      "max_output_tokens": 393216,
      "input_modalities": ["text", "image"],
      "output_modalities": ["text"],
      "effort": {
        "supported_levels": ["low", "high", "max"],
        "default_level": "high"
      },
      "api_capabilities": {
        "anthropic_messages": {
          "system_prompt_update": "in-history"
        }
      }
    },
    {
      "id": "deepseek-v4-pro",
      "object": "model",
      "owned_by": "deepseek",
      "name": "DeepSeek-V4-Pro",
      "context_window": 1048576,
      "max_output_tokens": 393216,
      "input_modalities": ["text"],
      "output_modalities": ["text"],
      "effort": {
        "supported_levels": ["low", "high", "max"],
        "default_level": "high"
      },
      "api_capabilities": {
        "anthropic_messages": {
          "system_prompt_update": "leading-only"
        }
      }
    }
  ]
}
```

## Code samples

### curl

```bash
# Set DEEPSEEK_API_KEY to your API key before running this example.
curl --silent --show-error --max-time 60 "https://api.deepseek.com/models" \
  --header "Authorization: Bearer ${DEEPSEEK_API_KEY}"
```

### Python — OpenAI SDK

```python
# Set DEEPSEEK_API_KEY to your API key before running this example.
import os
from openai import OpenAI

client = OpenAI(
    api_key=os.environ["DEEPSEEK_API_KEY"],
    base_url="https://api.deepseek.com",
    timeout=60.0,
)

models = client.models.list()
print(models.model_dump_json(indent=2))
```

## Referenced schemas

### schema-list-models-response

**ListModelsResponse** — `#/components/schemas/ListModelsResponse`

- `type`: `object`

- `required`: `["object","data"]`

- **Properties**

  - **`object`** (required)

    The object type, which is always `list`.

    - `type`: `string`

    - `enum`: `["list"]`

  - **`data`** (required)

    The list of model objects.

    - `type`: `array`

    - **Array items**

      - Reference: [Model](#schema-model) (`#/components/schemas/Model`)

### schema-model

**Model** — `#/components/schemas/Model`

- title: `Model`

Describes a DeepSeek model offering that can be used with the API. Besides the identifier fields, each model carries machine-readable metadata about its capabilities and limits; a metadata field may be omitted when the information is not available for that model.

- `type`: `object`

- `required`: `["id","object","owned_by"]`

- **Properties**

  - **`id`** (required)

    The model identifier, which can be referenced in the API endpoints.

    - `type`: `string`

  - **`object`** (required)

    The object type, which is always "model".

    - `type`: `string`

    - `enum`: `["model"]`

  - **`owned_by`** (required)

    The organization that owns the model.

    - `type`: `string`

  - **`name`** (optional)

    The display name of the model, for use in model pickers and model discovery tools.

    - `type`: `string`

  - **`context_window`** (optional)

    The total token capacity of the context window, counting both input and output tokens.

    - `type`: `integer`

  - **`max_output_tokens`** (optional)

    The maximum number of output tokens the server allows in a single response, i.e. the maximum accepted value of `max_tokens`.

    - `type`: `integer`

  - **`input_modalities`** (optional)

    The input types the model accepts.

    - `type`: `array`

    - **Array items**

      - `type`: `string`

      - `enum`: `["text","image"]`

  - **`output_modalities`** (optional)

    The media types the model can generate.

    - `type`: `array`

    - **Array items**

      - `type`: `string`

      - `enum`: `["text"]`

  - **`effort`** (optional)

    The effort levels available when thinking mode is enabled.

    - `type`: `object`

    - `required`: `["supported_levels"]`

    - **Properties**

      - **`supported_levels`** (required)

        The effort levels the model supports when thinking mode is enabled, in the recommended display order. These are the values accepted by the `reasoning_effort` parameter; `none`, which turns thinking mode off, is not included.

        - `type`: `array`

        - **Array items**

          - `type`: `string`

      - **`default_level`** (optional)

        The effort level the server uses when thinking mode is enabled and the request does not specify one. Always one of `supported_levels`. Only present when the server defines a default for the model.

        - `type`: `string`

  - **`api_capabilities`** (optional)

    Model behavior declared per API protocol.

    - `type`: `object`

    - **Properties**

      - **`anthropic_messages`** (optional)

        Capabilities that apply when the model is used through the [Anthropic Messages API](https://api-docs.deepseek.com/guides/anthropic_api.md).

        - `type`: `object`

        - `required`: `["system_prompt_update"]`

        - **Properties**

          - **`system_prompt_update`** (required)

            How the model picks up an updated system prompt during a conversation.

            - `leading-only`: only the system prompt at the start of the conversation takes effect. To change the system prompt, modify that leading system prompt; system messages appearing later in the history are not treated as system prompt updates.

            - `in-history`: a `system` message may be appended to the conversation history. The latest `system` message in the history provides the complete effective system prompt and replaces all earlier ones.

            - `type`: `string`

            - `enum`: `["leading-only","in-history"]`
