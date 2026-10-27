# Pas — DESIGN SYSTEM pomoćnik

Run the development server from the repository root:

```sh
python3 design-library/typography/serve.py --port 8766
```

Open http://127.0.0.1:8766/. The server binds only to loopback. Reload the page after restarting the server.

## Use

- Open **Pitaj psa** at the bottom right.
- Click an existing text entry, screenshot marker, or enable **Odaberi na ekranu** and click a text region.
- Use **Usporedi slične**, or type “usporedi ovo sa sličnim tekstovima”. Comparison uses captured typography grouped by semantic role, deduplicates identical component examples, and provides direct locate buttons.
- Type “pronađi 18 px” to find captured elements with that exact base font size.
- **Prompt za izmjenu** prepares a copyable Codex request. This inspector does not edit application code or saves.
- The microphone dictates into the input field; review the text and press **Pošalji**. It never reads answers aloud.

## AI connection

Local comparison works without an API key. Free-form AI chat needs an OpenAI API connection via **Spoji AI**. Enter the key only in that local masked field, or configure `OPENAI_API_KEY` in the server environment. Do not put keys in repository files or chat messages. Default model is `gpt-5.4-mini`; the model field is configurable. A real request checks model access and account quota.

The key stays in process memory, is never returned by status and is not logged or stored on disk. **Odspoji** clears it. The server sends the question, bounded recent conversation, selected reference and canonical measured catalog to OpenAI with `store: false`. Responses can only propose text and known element IDs; no tools or code-edit endpoint exist. API usage belongs to the connected account. No real upstream AI call has been validated while the local key is absent.

Browser speech recognition is used when available (`hr-HR`). Otherwise MediaRecorder records at most45seconds and uses the connected API's `gpt-4o-mini-transcribe` endpoint. Browser microphone permission is required. Closing the panel or hiding/leaving the page stops the microphone; cancelled recordings are discarded. A request already sent upstream may drain until its45second server timeout. Voice input needs a human microphone check; capability detection is not spoken-audio acceptance. No speech synthesis is implemented.

Client requests are bounded; clearing a conversation aborts its request and ignores stale completions. Server calls are serialized, timeout-bound, use same-origin/token checks and return sanitized errors. No browser storage is used for messages or keys.

## Validation

```sh
node --check design-library/typography/dog-chat.js
python3 design-library/typography/capture/test_dog_chat_server.py
```

The six HTTP tests cover disconnected operation, origin/token checks, memory-only configuration, canonical catalog/ID filtering, request bounds/concurrency and transcription multipart handling. Upstream responses are mocked; tests do not call or charge OpenAI.

Browser checks: selected-element context, typed comparison of7navigation titles, result navigation, exact18px lookup, screenshot marker pick and live browser speech capability. The original dog WebP is copied byte-exact; its avatar framing uses CSS only.

API implementation references: [text generation](https://developers.openai.com/api/docs/guides/text), [speech transcription](https://developers.openai.com/api/docs/guides/speech-to-text).
