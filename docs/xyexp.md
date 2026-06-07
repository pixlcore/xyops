# xyOps Expression Format

## Overview

xyOps uses a custom expression syntax built upon the open-source [JavaScript Expression Language](https://www.npmjs.com/package/jexl) (or JEXL).  We extend JEXL by adding a set of custom functions you can call from inside your expressions (see below), and also allow for inline macro expansion in string evaluations, using the popular `{{ mustache }}` syntax.  This is used to power the following xyOps subsystems:

- Monitor Expressions
- Alert Trigger Expressions
- Alert Messages
- Plugin Parameters
- Workflow Decision Controllers
- Workflow Split Controllers
- Web Hook Messages
- Email Templates

The xyOps Expression Format is a JavaScript-style syntax with dot paths, array indexing, arithmetic and boolean operators.  Using it you can traverse deep object trees (e.g. [ServerMonitorData](data.md#servermonitordata)), pull out individual values, and perform operations on one or more values.

Since it is built upon JEXL you can easily traverse arrays of objects, and select items from an array based on sub-object keys.  See examples below for details.

### Examples

- **Monitor Expression**: `processes.list[.command == 'ffmpeg'].memRss`
- **Alert Expression**: `monitors.load_avg >= (cpu.cores + 1)`
- **Alert Message**: `Less than 5% of total memory is available ({{bytes(memory.available)}} of {{bytes(memory.total)}})`

## Custom Functions

In addition to the standard JEXL operators, the following custom functions are available to use inside expressions:

### Math and Array

| Function | Usage | Description |
|----------|-------|-------------|
| `min` | `min(4, 5) == 4` | See [Math.min](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/min). |
| `max` | `min(4, 5) == 5` | See [Math.max](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/max). |
| `floor` | `floor(1.2) == 1` | See [Math.floor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/floor). |
| `ceil` | `ceil(1.2) == 2` | See [Math.ceil](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/ceil). |
| `round` | `round(1.2) == 1` | See [Math.round](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/round). |
| `clamp` | `clamp(50, 0, 100) == 50` | Clamps a numerical value between a lower and upper limit. |
| `count` | `count(array)` | Returns the number of items in an array (as JEXL arrays don't have a `length` inside expressions). |

### Searching

| Function | Usage | Description |
|----------|-------|-------------|
| `find` | `find(array, key, value)` | Finds objects in an array using a named property and a substring match. |
| `includes` | `includes(array, key)` | Find a substring in a string, or an element in an array. |
| `match` | `match(string, pattern)` | Perform a regex match on a string.  The pattern itself must also be specified as a string. |

### String Formatting

| Function | Usage | Description |
|----------|-------|-------------|
| `bytes` | `bytes(1048576) == "1 MB"` | Returns a human-friendly size given a raw byte count. |
| `number` | `number(1048576) == "1,048,576"` | Returns a human-friendly localized number (in the server's locale). |
| `pct` | `pct(0.5, 1.0) == "50%"` | Returns a human-friendly percentage given a value and a maximum. |
| `integer` | `integer("1abc") == "1"` | Attempts to coerce an integer out of a string. |
| `float` | `float(1.33333333) == "1.33"` | Shortens a float to a maximum of 2 digits after the decimal. |

### Misc

| Function | Usage | Description |
|----------|-------|-------------|
| `encode` | `encode("a b") == "a%20b` | Calls [encodeURIComponent](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent) to encode a string. |
| `stringify` | `stringify(obj) == "{...}"` | Calls [JSON.stringify](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) to serialize an object into a string. |
| `server` | `server("smog7ph67nvh6891z") == "myhostname.domain.com"` | Resolve a server ID to its label (or hostname if no label is set). |
| `event` | `event("emq3y5434ggm74ezk") == "Backup Database"` | Resolve an Event ID or Job ID to the event title. |

## See Also

- [Monitor Expressions](monitors.md#expressions)
- [Alert Expressions](alerts.md#alert-expressions)
- [Alert Messages](alerts.md#alert-messages)
- [Plugin Parameter Macro Expansion](plugins.md#macro-expansion)
- [Workflow Decision Controller](workflows.md#decision-controller)
- [Workflow Split Controller](workflows.md#split-controller)
