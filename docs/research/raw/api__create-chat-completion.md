# Chat Completions API

Creates a model response for the given chat conversation.

## Endpoint

```http
POST /chat/completions
```

operationId: `createChatCompletion`

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

## Request body

**required**

### application/json

- Reference: [CreateChatCompletionRequest](#schema-create-chat-completion-request) (`#/components/schemas/CreateChatCompletionRequest`)

## Responses

### 200 (No streaming)

OK, returns a `chat completion object`

#### application/json

- Reference: [CreateChatCompletionResponse](#schema-create-chat-completion-response) (`#/components/schemas/CreateChatCompletionResponse`)

**Example**

```json
{
  "id": "88beaa90-17fd-45fc-939c-2ef75e2d913c",
  "object": "chat.completion",
  "created": 1793084842,
  "model": "deepseek-flash",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! 👋 How can I help you today?"
      },
      "logprobs": null,
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 7,
    "completion_tokens": 11,
    "total_tokens": 18,
    "prompt_tokens_details": {
      "cached_tokens": 0
    },
    "prompt_cache_hit_tokens": 0,
    "prompt_cache_miss_tokens": 7
  },
  "system_fingerprint": "e72d3c7f663d3e1383b00b3884cb4501"
}
```

### 200 (Streaming)

OK, returns a streamed sequence of `chat completion chunk` objects

#### text/event-stream

- `type`: `array`

- **Array items**

  - Reference: [CreateChatCompletionStreamResponse](#schema-create-chat-completion-stream-response) (`#/components/schemas/CreateChatCompletionStreamResponse`)

**Example**

```
data: {"id":"071f229d-daa0-4557-a580-106a22e8df73","object":"chat.completion.chunk","created":1793084907,"model":"deepseek-flash","system_fingerprint":"e72d3c7f663d3e1383b00b3884cb4501","choices":[{"index":0,"delta":{"role":"assistant","content":""},"logprobs":null,"finish_reason":null}],"usage":null}

data: {"id":"071f229d-daa0-4557-a580-106a22e8df73","object":"chat.completion.chunk","created":1793084907,"model":"deepseek-flash","system_fingerprint":"e72d3c7f663d3e1383b00b3884cb4501","choices":[{"index":0,"delta":{"content":"Hello"},"logprobs":null,"finish_reason":null}],"usage":null}

data: {"id":"071f229d-daa0-4557-a580-106a22e8df73","object":"chat.completion.chunk","created":1793084907,"model":"deepseek-flash","system_fingerprint":"e72d3c7f663d3e1383b00b3884cb4501","choices":[{"index":0,"delta":{"content":"!"},"logprobs":null,"finish_reason":null}],"usage":null}

data: {"id":"071f229d-daa0-4557-a580-106a22e8df73","object":"chat.completion.chunk","created":1793084907,"model":"deepseek-flash","system_fingerprint":"e72d3c7f663d3e1383b00b3884cb4501","choices":[{"index":0,"delta":{"content":" 👋"},"logprobs":null,"finish_reason":null}],"usage":null}

data: {"id":"071f229d-daa0-4557-a580-106a22e8df73","object":"chat.completion.chunk","created":1793084907,"model":"deepseek-flash","system_fingerprint":"e72d3c7f663d3e1383b00b3884cb4501","choices":[{"index":0,"delta":{"content":" How"},"logprobs":null,"finish_reason":null}],"usage":null}

data: {"id":"071f229d-daa0-4557-a580-106a22e8df73","object":"chat.completion.chunk","created":1793084907,"model":"deepseek-flash","system_fingerprint":"e72d3c7f663d3e1383b00b3884cb4501","choices":[{"index":0,"delta":{"content":" can"},"logprobs":null,"finish_reason":null}],"usage":null}

data: {"id":"071f229d-daa0-4557-a580-106a22e8df73","object":"chat.completion.chunk","created":1793084907,"model":"deepseek-flash","system_fingerprint":"e72d3c7f663d3e1383b00b3884cb4501","choices":[{"index":0,"delta":{"content":" I"},"logprobs":null,"finish_reason":null}],"usage":null}

data: {"id":"071f229d-daa0-4557-a580-106a22e8df73","object":"chat.completion.chunk","created":1793084907,"model":"deepseek-flash","system_fingerprint":"e72d3c7f663d3e1383b00b3884cb4501","choices":[{"index":0,"delta":{"content":" help"},"logprobs":null,"finish_reason":null}],"usage":null}

data: {"id":"071f229d-daa0-4557-a580-106a22e8df73","object":"chat.completion.chunk","created":1793084907,"model":"deepseek-flash","system_fingerprint":"e72d3c7f663d3e1383b00b3884cb4501","choices":[{"index":0,"delta":{"content":" you"},"logprobs":null,"finish_reason":null}],"usage":null}

data: {"id":"071f229d-daa0-4557-a580-106a22e8df73","object":"chat.completion.chunk","created":1793084907,"model":"deepseek-flash","system_fingerprint":"e72d3c7f663d3e1383b00b3884cb4501","choices":[{"index":0,"delta":{"content":" today"},"logprobs":null,"finish_reason":null}],"usage":null}

data: {"id":"071f229d-daa0-4557-a580-106a22e8df73","object":"chat.completion.chunk","created":1793084907,"model":"deepseek-flash","system_fingerprint":"e72d3c7f663d3e1383b00b3884cb4501","choices":[{"index":0,"delta":{"content":"?"},"logprobs":null,"finish_reason":null}],"usage":null}

data: {"id":"071f229d-daa0-4557-a580-106a22e8df73","object":"chat.completion.chunk","created":1793084907,"model":"deepseek-flash","system_fingerprint":"e72d3c7f663d3e1383b00b3884cb4501","choices":[{"index":0,"delta":{"content":""},"logprobs":null,"finish_reason":"stop"}],"usage":{"prompt_tokens":7,"completion_tokens":11,"total_tokens":18,"prompt_tokens_details":{"cached_tokens":0},"prompt_cache_hit_tokens":0,"prompt_cache_miss_tokens":7}}

data: [DONE]
```

## Code samples

### curl

```bash
# Set DEEPSEEK_API_KEY to your API key before running this example.
curl --silent --show-error --max-time 60 "https://api.deepseek.com/chat/completions" \
  --header "Authorization: Bearer ${DEEPSEEK_API_KEY}" \
  --header "Content-Type: application/json" \
  --data '{
  "model": "deepseek-flash",
  "messages": [
    {
      "role": "user",
      "content": "Say hello."
    }
  ],
  "max_tokens": 32,
  "temperature": 0,
  "thinking": {
    "type": "disabled"
  },
  "stream": false
}'
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

response = client.chat.completions.create(
    model="deepseek-flash",
    messages=[{"role": "user", "content": "Say hello."}],
    max_tokens=32,
    temperature=0,
    stream=False,
    extra_body={"thinking": {"type": "disabled"}},
)
print(response.model_dump_json(indent=2))
```

## Referenced schemas

### schema-create-chat-completion-request

**CreateChatCompletionRequest** — `#/components/schemas/CreateChatCompletionRequest`

- `type`: `object`

- `required`: `["model","messages"]`

- **Properties**

  - **`messages`** (required)

    A list of messages comprising the conversation so far.

    - `type`: `array`

    - `minItems`: `1`

    - **Array items**

      - Reference: [ChatCompletionRequestMessage](#schema-chat-completion-request-message) (`#/components/schemas/ChatCompletionRequestMessage`)

    **Example**

    ```json
    [
      {
        "content": "You are a helpful assistant",
        "role": "system"
      },
      {
        "content": "Hi",
        "role": "user"
      }
    ]
    ```

  - **`model`** (required)

    ID of the model to use. Use `deepseek-flash` or `deepseek-v4-pro`.

    - `type`: `string`

    - `enum`: `["deepseek-flash","deepseek-v4-pro"]`

    **Example**

    ```json
    "deepseek-flash"
    ```

  - **`thinking`** (optional)

    Controls the switch between thinking and non-thinking mode. When `thinking` is omitted or `null`, the mode follows `reasoning_effort`; if `reasoning_effort` is also omitted, thinking is enabled. When this object is provided, `type` is required and takes precedence over `reasoning_effort` for selecting the mode.

    - `type`: `object`

    - `nullable`: `true`

    - `required`: `["type"]`

    - **Properties**

      - **`type`** (required)

        If set to `enabled`, then use thinking mode. If set to `disabled`, then use non-thinking model.

        - `type`: `string`

        - `enum`: `["enabled","disabled"]`

  - **`reasoning_effort`** (optional)

    Controls the thinking mode toggle and the thinking effort. `none` disables thinking mode; `low` / `high` / `max` enable thinking mode. The default effort is `high`. For compatibility with existing software, `minimal` is accepted and mapped to `low`, and `medium` / `xhigh` are accepted and mapped to `high`.

    - `type`: `string`

    - `enum`: `["none","low","high","max"]`

  - **`max_tokens`** (optional)

    The maximum number of tokens that can be generated in the chat completion.

    The total length of input tokens and generated tokens is limited by the model's context length.

    The value must be between 1 and 384K (393216). When not set, the default is 8K in non-thinking mode, 64K in thinking mode (128K with `reasoning_effort` set to `max`). Please refer to the [Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing.md) page for details.

    - `exclusiveMinimum`: `true`

    - `type`: `integer`

    - `nullable`: `true`

    **Example**

    ```json
    4096
    ```

  - **`response_format`** (optional)

    An object specifying the format that the model must output. If omitted or `null`, plain text is used. When this object is provided, `type` is required.
    Setting to { "type": "json\_object" } enables JSON Output, which guarantees the message the model generates is valid JSON.

    **Important:** When using JSON Output, you must also instruct the model to produce JSON yourself via a system or user message. If the model's output cannot be recognized as JSON, the API replaces the non-JSON content with spaces (`U+0020`). As a result, the message content may contain only spaces (appearing empty), even when `finish_reason` is `stop`. Also note that the message content may be partially cut off if finish\_reason="length", which indicates the generation exceeded max\_tokens or the conversation exceeded the max context length.

    - `type`: `object`

    - `nullable`: `true`

    - `required`: `["type"]`

    - **Properties**

      - **`type`** (required)

        Must be one of `text` or `json_object`.

        - `type`: `string`

        - `enum`: `["text","json_object"]`

        **Example**

        ```json
        "text"
        ```

  - **`stop`** (optional)

    Up to 16 sequences where the API will stop generating further tokens. Each sequence must be a non-empty string of at most 512 bytes (UTF-8 encoded).

    - `nullable`: `true`

    - `default`: `null`

    - **oneOf**

      - oneOf 1

        - title: `Single stop sequence`

        - `type`: `string`

        - `nullable`: `true`

        **Example**

        ```json
        null
        ```

      - oneOf 2

        - title: `Stop sequence list`

        - `type`: `array`

        - `minItems`: `1`

        - `maxItems`: `16`

        - **Array items**

          - `type`: `string`

  - **`stream`** (optional)

    If set, partial message deltas will be sent. Tokens will be sent as data-only server-sent events (SSE) as they become available, with the stream terminated by a `data: [DONE]` message.

    - `type`: `boolean`

    - `nullable`: `true`

    - `default`: `false`

  - **`stream_options`** (optional)

    - Reference: [ChatCompletionStreamOptions](#schema-chat-completion-stream-options) (`#/components/schemas/ChatCompletionStreamOptions`)

  - **`temperature`** (optional)

    What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.

    We generally recommend altering this or `top_p` but not both. Has no effect in thinking mode.

    - `type`: `number`

    - `minimum`: `0`

    - `maximum`: `2`

    - `default`: `1`

    - `nullable`: `true`

    **Example**

    ```json
    1
    ```

  - **`top_p`** (optional)

    An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top\_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered.

    The value must be greater than 0 and at most 1. We generally recommend altering this or `temperature` but not both. The effective value depends on the model and mode:

    - `deepseek-flash`: In thinking mode, the default is 1.0 and values below 0.95 are treated as 0.95. In non-thinking mode, it is fixed at 1.0 and the value you pass is ignored.

    - `deepseek-v4-pro`: In thinking mode, it is fixed at 0.95 when tool calling is enabled, or 1.0 otherwise; the value you pass is ignored. Setting `tool_choice` to `none` disables tool calling even when `tools` is provided. In non-thinking mode, the value you pass is used, with a default of 1.0.

    - `type`: `number`

    - `minimum`: `0`

    - `exclusiveMinimum`: `true`

    - `maximum`: `1`

    - `nullable`: `true`

    **Example**

    ```json
    1
    ```

  - **`tools`** (optional)

    A list of tools the model may call: functions, and the web tools `deepseek_web_search` and `deepseek_read_url` (see the [Web Tools Guide](https://api-docs.deepseek.com/guides/web_tools.md#chat-completions-api)).
    Use functions to provide a list of functions the model may generate JSON inputs for. Tool names must be unique.

    - `type`: `array`

    - `nullable`: `true`

    - **Array items**

      - **oneOf**

        - oneOf 1

          - Reference: [ChatCompletionTool](#schema-chat-completion-tool) (`#/components/schemas/ChatCompletionTool`)

        - oneOf 2

          - Reference: [ChatCompletionDeepSeekWebSearchTool](#schema-chat-completion-deep-seek-web-search-tool) (`#/components/schemas/ChatCompletionDeepSeekWebSearchTool`)

        - oneOf 3

          - Reference: [ChatCompletionDeepSeekReadUrlTool](#schema-chat-completion-deep-seek-read-url-tool) (`#/components/schemas/ChatCompletionDeepSeekReadUrlTool`)

    **Example**

    ```json
    null
    ```

  - **`tool_choice`** (optional)

    - Reference: [ChatCompletionToolChoiceOption](#schema-chat-completion-tool-choice-option) (`#/components/schemas/ChatCompletionToolChoiceOption`)

  - **`safety_check`** (optional)

    DeepSeek extension. Set `level` to `high` to turn on basic risk control, which reviews the model input and output. See the [Model Content Safety Guide](https://api-docs.deepseek.com/guides/safety.md).

    - `type`: `object`

    - `nullable`: `true`

    - `required`: `["level"]`

    - **Properties**

      - **`level`** (required)

        `high`: basic risk control. `low`: the default checks, the same as omitting `safety_check`.

        - `type`: `string`

        - `enum`: `["low","high"]`

  - **`title`** (optional)

    DeepSeek extension. Set `{"enabled": true}` to have the response carry a short title for the conversation. See the [Conversation Title Guide](https://api-docs.deepseek.com/guides/conversation_title.md).

    - `type`: `object`

    - `nullable`: `true`

    - `required`: `["enabled"]`

    - **Properties**

      - **`enabled`** (required)

        Whether to return a conversation title.

        - `type`: `boolean`

  - **`logprobs`** (optional)

    Whether to return log probabilities of the output tokens or not. If `true`, returns the log probabilities of each output token returned in the `content` of `message`.

    - `type`: `boolean`

    - `default`: `false`

    - `nullable`: `true`

  - **`top_logprobs`** (optional)

    An integer between 0 and 20 specifying the number of most likely tokens to return at each token position, each with an associated log probability. `logprobs` must be set to `true` if this parameter is used.

    - `type`: `integer`

    - `minimum`: `0`

    - `maximum`: `20`

    - `nullable`: `true`

    - `default`: `null`

    **Example**

    ```json
    null
    ```

  - **`user_id`** (optional)

    A custom user\_id. We recommend using only ASCII letters, digits, underscores (`_`), and hyphens (`-`). The UTF-8 encoded value must not exceed 512 bytes. Do not include user privacy information in the user\_id.

    - user\_id can be used to distinguish user identities on your side to help us with content safety review.

    - user\_id can be used for KVCache isolation for privacy management.

    - user\_id can be used for scheduling isolation of users on your business side.

    - For more details on the user\_id parameter, please refer to [Rate Limit & Isolation](https://api-docs.deepseek.com/quick_start/rate_limit.md)

    * `nullable`: `true`

  - **`frequency_penalty`** (optional)

    This parameter is no longer supported. It will not take effect if you pass it to the API.

    - `deprecated`: `true`

  - **`presence_penalty`** (optional)

    This parameter is no longer supported. It will not take effect if you pass it to the API.

    - `deprecated`: `true`

### schema-create-chat-completion-response

**CreateChatCompletionResponse** — `#/components/schemas/CreateChatCompletionResponse`

Represents a chat completion response returned by model, based on the provided input.

- `type`: `object`

- `required`: `["choices","created","id","model","system_fingerprint","object"]`

- **Properties**

  - **`id`** (required)

    A unique identifier for the chat completion.

    - `type`: `string`

  - **`choices`** (required)

    A list of chat completion choices.

    - `type`: `array`

    - **Array items**

      - `type`: `object`

      - `required`: `["finish_reason","index","message","logprobs"]`

      - **Properties**

        - **`finish_reason`** (required)

          The reason the model stopped generating tokens. This will be `stop` if the model hit a natural stop point or a provided stop sequence,
          `length` if the maximum number of tokens specified in the request was reached,
          `content_filter` if content was omitted due to a flag from our content filters,
          `tool_calls` if the model called a tool,
          `insufficient_system_resource` if the request is interrupted due to insufficient resource of the inference system,
          or `aborted` if the generation was interrupted.

          - `type`: `string`

          - `enum`: `["stop","length","content_filter","tool_calls","insufficient_system_resource","aborted"]`

        - **`index`** (required)

          The index of the choice in the list of choices.

          - `type`: `integer`

        - **`message`** (required)

          - Reference: [ChatCompletionResponseMessage](#schema-chat-completion-response-message) (`#/components/schemas/ChatCompletionResponseMessage`)

        - **`logprobs`** (required)

          Log probability information for the choice.

          - `type`: `object`

          - `nullable`: `true`

          - `required`: `["content"]`

          - **Properties**

            - **`content`** (required)

              A list of message content tokens with log probability information.

              - `type`: `array`

              - `nullable`: `true`

              - **Array items**

                - Reference: [ChatCompletionTokenLogprob](#schema-chat-completion-token-logprob) (`#/components/schemas/ChatCompletionTokenLogprob`)

            - **`reasoning_content`** (optional)

              A list of message content tokens with log probability information.

              - `type`: `array`

              - `nullable`: `true`

              - **Array items**

                - Reference: [ChatCompletionTokenLogprob](#schema-chat-completion-token-logprob) (`#/components/schemas/ChatCompletionTokenLogprob`)

  - **`created`** (required)

    The Unix timestamp (in seconds) of when the chat completion was created.

    - `type`: `integer`

  - **`model`** (required)

    The model used for the chat completion.

    - `type`: `string`

  - **`system_fingerprint`** (required)

    This fingerprint represents the backend configuration that the model runs with.

    - `type`: `string`

  - **`object`** (required)

    The object type, which is always `chat.completion`.

    - `type`: `string`

    - `enum`: `["chat.completion"]`

  - **`usage`** (optional)

    - Reference: [CompletionUsage](#schema-completion-usage) (`#/components/schemas/CompletionUsage`)

### schema-create-chat-completion-stream-response

**CreateChatCompletionStreamResponse** — `#/components/schemas/CreateChatCompletionStreamResponse`

Represents a streamed chunk of a chat completion response returned by model, based on the provided input.

- `type`: `object`

- `required`: `["choices","created","id","model","system_fingerprint","object"]`

- **Properties**

  - **`id`** (required)

    A unique identifier for the chat completion. Each chunk has the same ID.

    - `type`: `string`

  - **`choices`** (required)

    A list of chat completion choices.

    - `type`: `array`

    - **Array items**

      - `type`: `object`

      - `required`: `["delta","finish_reason","index"]`

      - **Properties**

        - **`delta`** (required)

          - Reference: [ChatCompletionStreamResponseDelta](#schema-chat-completion-stream-response-delta) (`#/components/schemas/ChatCompletionStreamResponseDelta`)

        - **`server_tool_event`** (optional)

          DeepSeek extension. With the web tools. The progress of a server-side tool call; a chunk carries at most one event. See the [Web Tools Guide](https://api-docs.deepseek.com/guides/web_tools.md#chat-completions-api).

          - `type`: `object`

        - **`logprobs`** (optional)

          Log probability information for the choice.

          - `type`: `object`

          - `nullable`: `true`

          - `required`: `["content"]`

          - **Properties**

            - **`content`** (required)

              A list of message content tokens with log probability information.

              - `type`: `array`

              - `nullable`: `true`

              - **Array items**

                - Reference: [ChatCompletionTokenLogprob](#schema-chat-completion-token-logprob) (`#/components/schemas/ChatCompletionTokenLogprob`)

            - **`reasoning_content`** (optional)

              A list of message content tokens with log probability information.

              - `type`: `array`

              - `nullable`: `true`

              - **Array items**

                - Reference: [ChatCompletionTokenLogprob](#schema-chat-completion-token-logprob) (`#/components/schemas/ChatCompletionTokenLogprob`)

        - **`finish_reason`** (required)

          The reason the model stopped generating tokens. This will be `stop` if the model hit a natural stop point or a provided stop sequence,
          `length` if the maximum number of tokens specified in the request was reached,
          `content_filter` if content was omitted due to a flag from our content filters,
          `tool_calls` if the model called a tool,
          `insufficient_system_resource` if the request is interrupted due to insufficient resource of the inference system,
          or `aborted` if the generation was interrupted.

          - `type`: `string`

          - `enum`: `["stop","length","content_filter","tool_calls","insufficient_system_resource","aborted"]`

          - `nullable`: `true`

        - **`index`** (required)

          The index of the choice in the list of choices.

          - `type`: `integer`

  - **`created`** (required)

    The Unix timestamp (in seconds) of when the chat completion was created. Each chunk has the same timestamp.

    - `type`: `integer`

  - **`model`** (required)

    The model to generate the completion.

    - `type`: `string`

  - **`system_fingerprint`** (required)

    This fingerprint represents the backend configuration that the model runs with.

    - `type`: `string`

  - **`object`** (required)

    The object type, which is always `chat.completion.chunk`.

    - `type`: `string`

    - `enum`: `["chat.completion.chunk"]`

### schema-chat-completion-request-message

**ChatCompletionRequestMessage** — `#/components/schemas/ChatCompletionRequestMessage`

- **oneOf**

  - oneOf 1

    - Reference: [ChatCompletionRequestSystemMessage](#schema-chat-completion-request-system-message) (`#/components/schemas/ChatCompletionRequestSystemMessage`)

  - oneOf 2

    - Reference: [ChatCompletionRequestUserMessage](#schema-chat-completion-request-user-message) (`#/components/schemas/ChatCompletionRequestUserMessage`)

  - oneOf 3

    - Reference: [ChatCompletionRequestAssistantMessage](#schema-chat-completion-request-assistant-message) (`#/components/schemas/ChatCompletionRequestAssistantMessage`)

  - oneOf 4

    - Reference: [ChatCompletionRequestToolMessage](#schema-chat-completion-request-tool-message) (`#/components/schemas/ChatCompletionRequestToolMessage`)

  - oneOf 5

    - Reference: [ChatCompletionRequestLatestReminderMessage](#schema-chat-completion-request-latest-reminder-message) (`#/components/schemas/ChatCompletionRequestLatestReminderMessage`)

### schema-chat-completion-stream-options

**ChatCompletionStreamOptions** — `#/components/schemas/ChatCompletionStreamOptions`

Options for streaming response. Must be set together with `stream: true`; if `stream` is not set to `true`, the API returns a `400` error.

- `type`: `object`

- `nullable`: `true`

- `default`: `null`

- **Properties**

  - **`include_usage`** (optional)

    If set to `true`, all chunks in the stream will include a `usage` field, whose value is `null` on every chunk except the last one. If omitted or set to `false`, the `usage` field is absent from all chunks except the last one.

    Either way, the last chunk before the `data: [DONE]` message carries the token usage statistics for the entire request in its `usage` field. Note that no separate usage-only chunk is emitted: the statistics ride on the last content chunk, whose `choices` array always contains exactly one element that carries no new content and a non-null `finish_reason`.

    - `type`: `boolean`

**Example**

```json
null
```

### schema-chat-completion-tool

**ChatCompletionTool** — `#/components/schemas/ChatCompletionTool`

- title: `Function tool`

- `type`: `object`

- `required`: `["type","function"]`

- **Properties**

  - **`type`** (required)

    The type of the tool, in this case `function`.

    - `type`: `string`

    - `enum`: `["function"]`

  - **`function`** (required)

    - Reference: [FunctionObject](#schema-function-object) (`#/components/schemas/FunctionObject`)

### schema-chat-completion-deep-seek-web-search-tool

**ChatCompletionDeepSeekWebSearchTool** — `#/components/schemas/ChatCompletionDeepSeekWebSearchTool`

- title: `DeepSeek web search tool`

DeepSeek extension. Lets the model search the web; with thinking enabled, it runs deep thinking search. See the [Web Tools Guide](https://api-docs.deepseek.com/guides/web_tools.md#chat-completions-api).

- `type`: `object`

- `required`: `["type"]`

- **Properties**

  - **`type`** (required)

    The type of the tool, in this case `deepseek_web_search`.

    - `type`: `string`

    - `enum`: `["deepseek_web_search"]`

### schema-chat-completion-deep-seek-read-url-tool

**ChatCompletionDeepSeekReadUrlTool** — `#/components/schemas/ChatCompletionDeepSeekReadUrlTool`

- title: `DeepSeek read URL tool`

DeepSeek extension. Lets the model read the links in the last user message. See the [Web Tools Guide](https://api-docs.deepseek.com/guides/web_tools.md#read-links).

- `type`: `object`

- `required`: `["type"]`

- **Properties**

  - **`type`** (required)

    The type of the tool, in this case `deepseek_read_url`.

    - `type`: `string`

    - `enum`: `["deepseek_read_url"]`

### schema-chat-completion-tool-choice-option

**ChatCompletionToolChoiceOption** — `#/components/schemas/ChatCompletionToolChoiceOption`

Controls which (if any) tool is called by the model.

`none` means the model will not call any tool and instead generates a message.

`auto` means the model can pick between generating a message or calling one or more tools.

`required` means the model must call one or more tools.

Specifying a particular tool via `{"type": "function", "function": {"name": "my_function"}}` forces the model to call that tool.

`none` is the default when no tools are present. `auto` is the default if tools are present.

`required` and named tool choices are not supported in thinking mode; the API returns a `400` error. Disable thinking mode first to use them. With the web tools declared, `required` is treated as `auto`.

- `type`: `["string","object"]`

- `nullable`: `true`

- **oneOf**

  - oneOf 1

    - Reference: [ChatCompletionToolChoice](#schema-chat-completion-tool-choice) (`#/components/schemas/ChatCompletionToolChoice`)

  - oneOf 2

    - Reference: [ChatCompletionNamedToolChoice](#schema-chat-completion-named-tool-choice) (`#/components/schemas/ChatCompletionNamedToolChoice`)

### schema-chat-completion-response-message

**ChatCompletionResponseMessage** — `#/components/schemas/ChatCompletionResponseMessage`

A chat completion message generated by the model.

- `type`: `object`

- `required`: `["role","content"]`

- **Properties**

  - **`content`** (required)

    The contents of the message.

    - `type`: `string`

    - `nullable`: `true`

  - **`reasoning_content`** (optional)

    For thinking mode only. The reasoning contents of the assistant message, before the final answer.

    - `type`: `string`

    - `nullable`: `true`

  - **`tool_calls`** (optional)

    - Reference: [ChatCompletionMessageToolCalls](#schema-chat-completion-message-tool-calls) (`#/components/schemas/ChatCompletionMessageToolCalls`)

  - **`role`** (required)

    The role of the author of this message.

    - `type`: `string`

    - `enum`: `["assistant"]`

  - **`annotations`** (optional)

    With the web tools. The citations in `content`. See [Web Tools - Citations](https://api-docs.deepseek.com/guides/web_tools.md#citations).

    - `type`: `array`

    - **Array items**

      - `type`: `object`

  - **`server_tool_calls`** (optional)

    DeepSeek extension. With the web tools. The server-side tool calls of this response, one entry per step; pass it back unchanged in the next request. See the [Web Tools Guide](https://api-docs.deepseek.com/guides/web_tools.md#chat-completions-api).

    - `type`: `array`

    - **Array items**

      - `type`: `object`

  - **`title`** (optional)

    DeepSeek extension. The conversation title, returned when `title.enabled` is `true`. See the [Conversation Title Guide](https://api-docs.deepseek.com/guides/conversation_title.md).

    - `type`: `string`

  - **`refusal`** (optional)

    Names the blocked images when images in the request fail the model content safety review. See the [Model Content Safety Guide](https://api-docs.deepseek.com/guides/safety.md#handling-refusals).

    - `type`: `string`

### schema-chat-completion-token-logprob

**ChatCompletionTokenLogprob** — `#/components/schemas/ChatCompletionTokenLogprob`

- `type`: `object`

- `required`: `["token","logprob","bytes","top_logprobs"]`

- **Properties**

  - **`token`** (required)

    The token.

    - `type`: `string`

  - **`logprob`** (required)

    The log probability of this token, if it is within the top 20 most likely tokens. Otherwise, the value `-9999.0` is used to signify that the token is very unlikely.

    - `type`: `number`

  - **`bytes`** (required)

    A list of integers representing the UTF-8 bytes representation of the token. Useful in instances where characters are represented by multiple tokens and their byte representations must be combined to generate the correct text representation. Can be `null` if there is no bytes representation for the token.

    - `type`: `array`

    - `nullable`: `true`

    - **Array items**

      - `type`: `integer`

  - **`top_logprobs`** (required)

    List of the most likely tokens and their log probability, at this token position. In rare cases, there may be fewer than the number of requested `top_logprobs` returned.

    - `type`: `array`

    - **Array items**

      - `type`: `object`

      - `required`: `["token","logprob","bytes"]`

      - **Properties**

        - **`token`** (required)

          The token.

          - `type`: `string`

        - **`logprob`** (required)

          The log probability of this token, if it is within the top 20 most likely tokens. Otherwise, the value `-9999.0` is used to signify that the token is very unlikely.

          - `type`: `number`

        - **`bytes`** (required)

          A list of integers representing the UTF-8 bytes representation of the token. Useful in instances where characters are represented by multiple tokens and their byte representations must be combined to generate the correct text representation. Can be `null` if there is no bytes representation for the token.

          - `type`: `array`

          - `nullable`: `true`

          - **Array items**

            - `type`: `integer`

### schema-completion-usage

**CompletionUsage** — `#/components/schemas/CompletionUsage`

Usage statistics for the completion request.

- `type`: `object`

- `required`: `["prompt_tokens","prompt_tokens_details","prompt_cache_hit_tokens","prompt_cache_miss_tokens","completion_tokens","total_tokens"]`

- **Properties**

  - **`completion_tokens`** (required)

    Number of tokens in the generated completion.

    - `type`: `integer`

  - **`prompt_tokens`** (required)

    Number of tokens in the prompt. It equals prompt\_cache\_hit\_tokens + prompt\_cache\_miss\_tokens.

    - `type`: `integer`

  - **`prompt_tokens_details`** (required)

    Breakdown of tokens used in the prompt.

    - `type`: `object`

    - **Properties**

      - **`cached_tokens`** (optional)

        Number of tokens in the prompt that hit the context cache. Same as `prompt_cache_hit_tokens`.

        - `type`: `integer`

  - **`prompt_cache_hit_tokens`** (required)

    Number of tokens in the prompt that hits the context cache.

    - `type`: `integer`

  - **`prompt_cache_miss_tokens`** (required)

    Number of tokens in the prompt that misses the context cache.

    - `type`: `integer`

  - **`total_tokens`** (required)

    Total number of tokens used in the request (prompt + completion).

    - `type`: `integer`

  - **`completion_tokens_details`** (optional)

    Breakdown of tokens used in a completion.

    - `type`: `object`

    - **Properties**

      - **`reasoning_tokens`** (optional)

        Tokens generated by the model for reasoning.

        - `type`: `integer`

      - **`safety_tokens`** (optional)

        DeepSeek extension. Tokens of the safety review, already included in `completion_tokens`. Present only when `safety_check` is `high`.

        - `type`: `integer`

        - `minimum`: `0`

  - **`server_tool_use`** (optional)

    With the web tools. The numbers of searches and fetches; omitted when all counts are zero. See the [Web Tools Guide](https://api-docs.deepseek.com/guides/web_tools.md#chat-completions-api).

    - `type`: `object`

    - **Properties**

      - **`tool_search`** (optional)

        Number of searches, excluding image searches.

        - `type`: `integer`

        - `minimum`: `0`

      - **`tool_fetch`** (optional)

        Number of page fetches.

        - `type`: `integer`

        - `minimum`: `0`

      - **`tool_image_search`** (optional)

        Number of image searches.

        - `type`: `integer`

        - `minimum`: `0`

### schema-chat-completion-stream-response-delta

**ChatCompletionStreamResponseDelta** — `#/components/schemas/ChatCompletionStreamResponseDelta`

A chat completion delta generated by streamed model responses.

- `type`: `object`

- **Properties**

  - **`content`** (optional)

    The contents of the chunk message.

    - `type`: `string`

    - `nullable`: `true`

  - **`reasoning_content`** (optional)

    For thinking mode only. The reasoning contents of the assistant message, before the final answer.

    - `type`: `string`

    - `nullable`: `true`

  - **`role`** (optional)

    The role of the author of this message.

    - `type`: `string`

    - `enum`: `["assistant"]`

  - **`tool_calls`** (optional)

    The tool calls generated by the model, such as function calls. The first chunk of each tool call carries the `id`, `type` and `function` fields; subsequent chunks only carry the function arguments.

    - `type`: `array`

    - **Array items**

      - Reference: [ChatCompletionMessageToolCallChunk](#schema-chat-completion-message-tool-call-chunk) (`#/components/schemas/ChatCompletionMessageToolCallChunk`)

  - **`annotations`** (optional)

    With the web tools. The citations in `content`. See [Web Tools - Citations](https://api-docs.deepseek.com/guides/web_tools.md#citations). In streaming, sent once in the last chunk.

    - `type`: `array`

    - **Array items**

      - `type`: `object`

  - **`server_tool_calls`** (optional)

    DeepSeek extension. With the web tools. The server-side tool calls of this response, one entry per step; pass it back unchanged in the next request. See the [Web Tools Guide](https://api-docs.deepseek.com/guides/web_tools.md#chat-completions-api). In streaming, sent once in the last chunk.

    - `type`: `array`

    - **Array items**

      - `type`: `object`

  - **`title`** (optional)

    DeepSeek extension. The conversation title, returned when `title.enabled` is `true`. See the [Conversation Title Guide](https://api-docs.deepseek.com/guides/conversation_title.md). In streaming, sent once in the last chunk.

    - `type`: `string`

  - **`refusal`** (optional)

    Names the blocked images when images in the request fail the model content safety review. See the [Model Content Safety Guide](https://api-docs.deepseek.com/guides/safety.md#handling-refusals). In streaming, sent once in the last chunk.

    - `type`: `string`

### schema-chat-completion-request-system-message

**ChatCompletionRequestSystemMessage** — `#/components/schemas/ChatCompletionRequestSystemMessage`

- title: `System message`

- `type`: `object`

- `required`: `["content","role"]`

- **Properties**

  - **`content`** (required)

    The contents of the system message.

    - `type`: `string`

  - **`role`** (required)

    The role of the messages author, in this case `system`.

    - `type`: `string`

    - `enum`: `["system"]`

  - **`name`** (optional)

    An optional name for the participant. Provides the model information to differentiate between participants of the same role.

    - `type`: `string`

### schema-chat-completion-request-user-message

**ChatCompletionRequestUserMessage** — `#/components/schemas/ChatCompletionRequestUserMessage`

- title: `User message`

- `type`: `object`

- `required`: `["content","role"]`

- **Properties**

  - **`content`** (required)

    The contents of the user message. Either a string, or an array of content parts (for image input). See the [Vision guide](https://api-docs.deepseek.com/guides/vision.md) for details.

    - **oneOf**

      - oneOf 1

        - title: `Text content`

        - `type`: `string`

      - oneOf 2

        - title: `Array of content parts`

        - `type`: `array`

        - `minItems`: `1`

        - **Array items**

          - Reference: [ChatCompletionRequestContentPart](#schema-chat-completion-request-content-part) (`#/components/schemas/ChatCompletionRequestContentPart`)

  - **`role`** (required)

    The role of the messages author, in this case `user`.

    - `type`: `string`

    - `enum`: `["user"]`

  - **`name`** (optional)

    An optional name for the participant. Provides the model information to differentiate between participants of the same role.

    - `type`: `string`

### schema-chat-completion-request-assistant-message

**ChatCompletionRequestAssistantMessage** — `#/components/schemas/ChatCompletionRequestAssistantMessage`

- title: `Assistant message`

- `type`: `object`

- `required`: `["role","content"]`

- **Properties**

  - **`content`** (required)

    The contents of the assistant message.

    - `nullable`: `true`

    - `type`: `string`

  - **`role`** (required)

    The role of the messages author, in this case `assistant`.

    - `type`: `string`

    - `enum`: `["assistant"]`

  - **`name`** (optional)

    An optional name for the participant. Provides the model information to differentiate between participants of the same role.

    - `type`: `string`

  - **`prefix`** (optional)

    (Beta) Set this to `true` to force the model to start its answer by the content of the supplied prefix in this `assistant` message.
    You must set `base_url="https://api.deepseek.com/beta"` to use this feature.

    - `type`: `bool`

  - **`reasoning_content`** (optional)

    (Beta) Used for the thinking mode in the [Chat Prefix Completion](https://api-docs.deepseek.com/guides/chat_prefix_completion.md) feature as the input for the CoT in the last assistant message. When using this feature, the `prefix` parameter must be set to `true`.

    - `nullable`: `true`

    - `type`: `string`

  - **`server_tool_calls`** (optional)

    DeepSeek extension. The `server_tool_calls` of an earlier response, passed back unchanged. See the [Web Tools Guide](https://api-docs.deepseek.com/guides/web_tools.md#chat-completions-api).

    - `type`: `array`

    - **Array items**

      - `type`: `object`

### schema-chat-completion-request-tool-message

**ChatCompletionRequestToolMessage** — `#/components/schemas/ChatCompletionRequestToolMessage`

- title: `Tool message`

- `type`: `object`

- `required`: `["role","content","tool_call_id"]`

- **Properties**

  - **`role`** (required)

    The role of the messages author, in this case `tool`.

    - `type`: `string`

    - `enum`: `["tool"]`

  - **`content`** (required)

    - title: `Text content`

    The contents of the tool message. Either a string, or an array of content parts (for image input). See the [Vision guide](https://api-docs.deepseek.com/guides/vision.md) for details.

    - **oneOf**

      - oneOf 1

        - title: `Text content`

        - `type`: `string`

      - oneOf 2

        - title: `Array of content parts`

        - `type`: `array`

        - `minItems`: `1`

        - **Array items**

          - Reference: [ChatCompletionRequestContentPart](#schema-chat-completion-request-content-part) (`#/components/schemas/ChatCompletionRequestContentPart`)

  - **`tool_call_id`** (required)

    Tool call that this message is responding to.

    - `type`: `string`

### schema-chat-completion-request-latest-reminder-message

**ChatCompletionRequestLatestReminderMessage** — `#/components/schemas/ChatCompletionRequestLatestReminderMessage`

- title: `Latest reminder message`

DeepSeek extension. Gives the model the current date, location, platform and language, like DeepSeek Chat. Place it directly before the `user` message it belongs to; anywhere else it returns `400`. See the [User Metadata Marker Guide](https://api-docs.deepseek.com/guides/latest_reminder.md).

- `type`: `object`

- `required`: `["role","content"]`

- **Properties**

  - **`role`** (required)

    The role of the messages author, in this case `latest_reminder`.

    - `type`: `string`

    - `enum`: `["latest_reminder"]`

  - **`content`** (required)

    `<date>,<weekday>,<location>,<platform>,<language>`, for example `2026-11-11,Wednesday,Singapore,Web,English`.

    - `type`: `string`

### schema-function-object

**FunctionObject** — `#/components/schemas/FunctionObject`

- `type`: `object`

- `required`: `["name"]`

- **Properties**

  - **`description`** (optional)

    A description of what the function does, used by the model to choose when and how to call the function.

    - `type`: `string`

  - **`name`** (required)

    The name of the function to be called. Must be a-z, A-Z, 0-9, or contain underscores and dashes, with a maximum length of 128.

    - `type`: `string`

  - **`parameters`** (optional)

    - Reference: [FunctionParameters](#schema-function-parameters) (`#/components/schemas/FunctionParameters`)

  - **`strict`** (optional)

    If set to `true`, the API will use strict-mode for the tool calls to ensure the output always complies with the function's JSON schema. This is a Beta feature, for more details please refer to [Tool Calls Guide](https://api-docs.deepseek.com/guides/tool_calls.md)

    - `type`: `boolean`

    - `default`: `false`

### schema-chat-completion-tool-choice

**ChatCompletionToolChoice** — `#/components/schemas/ChatCompletionToolChoice`

- `type`: `string`

- `enum`: `["none","auto","required"]`

### schema-chat-completion-named-tool-choice

**ChatCompletionNamedToolChoice** — `#/components/schemas/ChatCompletionNamedToolChoice`

Specifies a tool the model should use. Use to force the model to call a specific function.

- `type`: `object`

- `required`: `["type","function"]`

- **Properties**

  - **`type`** (required)

    The type of the tool. Currently, only `function` is supported.

    - `type`: `string`

    - `enum`: `["function"]`

  - **`function`** (required)

    - `type`: `object`

    - `required`: `["name"]`

    - **Properties**

      - **`name`** (required)

        The name of the function to call.

        - `type`: `string`

### schema-chat-completion-message-tool-calls

**ChatCompletionMessageToolCalls** — `#/components/schemas/ChatCompletionMessageToolCalls`

The tool calls generated by the model.

- `type`: `array`

- **Array items**

  - Reference: [ChatCompletionMessageToolCall](#schema-chat-completion-message-tool-call) (`#/components/schemas/ChatCompletionMessageToolCall`)

### schema-chat-completion-message-tool-call-chunk

**ChatCompletionMessageToolCallChunk** — `#/components/schemas/ChatCompletionMessageToolCallChunk`

- `type`: `object`

- `required`: `["index"]`

- **Properties**

  - **`index`** (required)

    - `type`: `integer`

  - **`id`** (optional)

    The ID of the tool call.

    - `type`: `string`

  - **`type`** (optional)

    The type of the tool. Currently, only `function` is supported.

    - `type`: `string`

    - `enum`: `["function"]`

  - **`function`** (optional)

    - `type`: `object`

    - **Properties**

      - **`name`** (optional)

        The name of the function to call.

        - `type`: `string`

      - **`arguments`** (optional)

        The arguments to call the function with, as generated by the model in JSON format. Note that the model does not always generate valid JSON, and may hallucinate parameters not defined by your function schema. Validate the arguments in your code before calling your function.

        - `type`: `string`

### schema-chat-completion-request-content-part

**ChatCompletionRequestContentPart** — `#/components/schemas/ChatCompletionRequestContentPart`

- **oneOf**

  - oneOf 1

    - Reference: [ChatCompletionRequestContentPartText](#schema-chat-completion-request-content-part-text) (`#/components/schemas/ChatCompletionRequestContentPartText`)

  - oneOf 2

    - Reference: [ChatCompletionRequestContentPartImage](#schema-chat-completion-request-content-part-image) (`#/components/schemas/ChatCompletionRequestContentPartImage`)

  - oneOf 3

    - Reference: [ChatCompletionRequestContentPartFile](#schema-chat-completion-request-content-part-file) (`#/components/schemas/ChatCompletionRequestContentPartFile`)

### schema-function-parameters

**FunctionParameters** — `#/components/schemas/FunctionParameters`

The parameters the functions accepts, described as a JSON Schema object. See the [Tool Calls Guide](https://api-docs.deepseek.com/guides/tool_calls.md) for examples, and the [JSON Schema reference](https://json-schema.org/understanding-json-schema/) for documentation about the format.

Omitting `parameters` defines a function with an empty parameter list.

- `type`: `object`

- **additionalProperties**

  - Schema: `true`

### schema-chat-completion-message-tool-call

**ChatCompletionMessageToolCall** — `#/components/schemas/ChatCompletionMessageToolCall`

- `type`: `object`

- `required`: `["id","type","function"]`

- **Properties**

  - **`id`** (required)

    The ID of the tool call.

    - `type`: `string`

  - **`type`** (required)

    The type of the tool. Currently, only `function` is supported.

    - `type`: `string`

    - `enum`: `["function"]`

  - **`function`** (required)

    The function that the model called.

    - `type`: `object`

    - `required`: `["name","arguments"]`

    - **Properties**

      - **`name`** (required)

        The name of the function to call.

        - `type`: `string`

      - **`arguments`** (required)

        The arguments to call the function with, as generated by the model in JSON format. Note that the model does not always generate valid JSON, and may hallucinate parameters not defined by your function schema. Validate the arguments in your code before calling your function.

        - `type`: `string`

### schema-chat-completion-request-content-part-text

**ChatCompletionRequestContentPartText** — `#/components/schemas/ChatCompletionRequestContentPartText`

- title: `Text content part`

- `type`: `object`

- `required`: `["type","text"]`

- **Properties**

  - **`type`** (required)

    The type of the content part, in this case `text`.

    - `type`: `string`

    - `enum`: `["text"]`

  - **`text`** (required)

    The text content.

    - `type`: `string`

### schema-chat-completion-request-content-part-image

**ChatCompletionRequestContentPartImage** — `#/components/schemas/ChatCompletionRequestContentPartImage`

- title: `Image content part`

- `type`: `object`

- `required`: `["type","image_url"]`

- **Properties**

  - **`type`** (required)

    The type of the content part, in this case `image_url`.

    - `type`: `string`

    - `enum`: `["image_url"]`

  - **`image_url`** (required)

    - `type`: `object`

    - `required`: `["url"]`

    - **Properties**

      - **`url`** (required)

        Either an `http(s)` URL of the image (max 8192 characters) or a base64-encoded data URL (`data:image/jpeg;base64,...`). Supported formats: JPEG, PNG, GIF, and WebP.

        - `type`: `string`

      - **`detail`** (optional)

        Controls how the image is processed. `low` downsamples the image to 512x512 (faster, cheaper). `high`, `original`, and `auto` keep the original image.

        - `type`: `string`

        - `enum`: `["low","high","original","auto"]`

### schema-chat-completion-request-content-part-file

**ChatCompletionRequestContentPartFile** — `#/components/schemas/ChatCompletionRequestContentPartFile`

- title: `File content part`

Exactly one of `file_id` and `file_data` is required: passing neither returns a `400` error ("file must have a file\_id or file\_data"); passing both returns a `400` error ("file cannot have both file\_id and file\_data").

- `type`: `object`

- `required`: `["type"]`

- **Properties**

  - **`type`** (required)

    The type of the content part, in this case `file`.

    - `type`: `string`

    - `enum`: `["file"]`

  - **`file_id`** (optional)

    The ID of a file uploaded via the [Files API](https://api-docs.deepseek.com/guides/files_api.md), of the form `file-api-...`. Mutually exclusive with `file_data`.

    - `type`: `string`

  - **`file_data`** (optional)

    A base64-encoded data URL of the image (`data:image/jpeg;base64,...`). Mutually exclusive with `file_id`.

    - `type`: `string`

  - **`filename`** (optional)

    An optional filename. Only valid together with `file_data`.

    - `type`: `string`
