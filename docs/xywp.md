# xyOps Wire Protocol

This document describes the **xyOps Wire Protocol** (XYWP) v1.0, which is a standard method of communication between two processes that may know nothing about each other.  The processes may be written in different languages, or be binary executables.  The wire protocol simply defines a means of exchanging structured data between them in a language-agnostic way.

xyOps uses the wire protocol to communicate with its Plugins, which may be written in any language.

- **Title**: xyOps Wire Protocol
- **ID**: XYWP
- **Version**: 1.0
- **Date**: November 16, 2025
- **Authors**: Joseph Huckaby (PixlCore)

## Overview

XYWP uses [JSON](https://en.wikipedia.org/wiki/JSON) over [STDIO](https://en.wikipedia.org/wiki/Standard_streams) pipes for the basis of communication.  Specifically, [NDJSON](https://github.com/ndjson/ndjson-spec) is utilized, meaning a full JSON message is compacted onto a single line.  The sender needs to delimit the JSON with a single EOL character (ASCII 10), and the receiver needs to line-read to delimit the incoming message.  XYWP builds on this base protocol by introducing a few key properties into the top-level JSON, which allow the receiver to learn more about the message (see below).

In most cases the two parties communicating are xyOps / xySat, and a Plugin, which is spawned as a subprocess with STDIO pipes connected to the parent.  Meaning, xyOps can send serialized JSON messages directly into the child's STDIN stream, and likewise the child process can write serialized JSON to its STDOUT stream, which is captured back in the parent process.

Only STDIN and STDOUT streams are used.  STDERR is **not** part of the protocol, and is usually captured by the parent process as raw text and displayed to the user, in the event of an error.

## Properties

The only property always present at the top-level of all XYWP messages is `xy`, which indicates the wire protocol version, and should always be set to `1`.

### Requests

When xyOps is sending a "request" to a Plugin, the following properties will be included at the top-level of the JSON message:

| Property Name | Type | Description |
|---------------|------|-------------|
| `xy` | Number | **(Required)** The xyOps Wire Protocol version, which should be set to `1`. |
| `type` | String | The type of message being sent, which varies based on the intent. |

### Responses

When a Plugin is sending a "response" back to xyOps, the following properties will be included at the top-level of the JSON message:

| Property Name | Type | Description |
|---------------|------|-------------|
| `xy` | Number | **(Required)** The xyOps Wire Protocol version, which should be set to `1`. |
| `code` | Mixed | If the message is a response, the `code` property determines success or failure.  Any "falsey" value such as `0` or `false` indicates success.  Any "truthy" value indicates an error, and also provides the error code. |
| `description` | String | In the event of an error, this property should contain a short human-readable description of the error.  It is optional for success. |

When a `code` property is present in a response message, it indicates that the Plugin has completed and will exit.  If the `code` property is **not** present, it indicates that the Plugin is still in progress, and is providing an intermediate update.

## Examples

Here is an example request to launch a job (Event Plugin):

```json
{
	"xy": 1, 
	"type": "event", 
	"id": "jmhzaot10tm",
	"event": "emi11ejdlde",
	"plugin": "pmi11dqsxcy",
	"server": "smf4j79snhe",
	"now": 1763256572.024,
	/* See Job data structure for more */
}
```

Here is an example response which reports progress (i.e. no `code` property):

```json
{ "xy": 1, "progress": 0.5 }
```

Here is an example "final" response (with `code` property) indicating success, and that the Plugin will exit shortly:

```json
{ "xy": 1, "code": 0 }
```

Here is an example final response indicating an error:

```json
{ "xy": 1, "code": 999, "description": "Failed to connect to database." }
```

## Passthrough

XYWP is designed to support "passthrough" JSON, meaning if a child process emits JSON to STDOUT that **isn't** recognized as a XYWP message (it doesn't have a top-level `xy` property or it isn't set to `1`), the message will be completely ignored, and "passed through" as plain text.

In the case of xyOps Event Plugins running jobs, "plain old JSON" can be emitted to STDOUT and will be largely ignored by xyOps, and simply logged as part of the job output.

## References

- [JSON](https://en.wikipedia.org/wiki/JSON)
- [NDJSON](https://github.com/ndjson/ndjson-spec)
- [STDIO](https://en.wikipedia.org/wiki/Standard_streams)
- [Wire Protocol](https://en.wikipedia.org/wiki/Wire_protocol)
