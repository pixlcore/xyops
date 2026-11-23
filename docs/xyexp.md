# xyOps Expression Format

## Overview

xyOps uses a custom expression syntax built upon the open-source [JavaScript Expression Language](https://www.npmjs.com/package/jexl) (or JEXL).  We extend JEXL by adding a set of custom functions you can call from inside your expressions (see below), and also allow for inline macro expansion in string evaluations, using the popular `{{ mustache }}` syntax.  This is used to power the following xyOps subsystems:

- Monitor Expressions
- Alert Trigger Expressions
- Alert Messages
- Plugin Parameters
- Workflow Decision Controllers
- Workflow Split Controllers
- Custom Job Override Rules
- Web Hook Messages
- Email Templates

The xyOps Expression Format is a JavaScript-style syntax with dot paths, array indexing, arithmetic and boolean operators.  Using it you can traverse deep object trees (e.g. [ServerMonitorData](data.md#servermonitordata)), pull out individual values, and perform operations on one or more values.

Since it is built upon JEXL you can easily traverse arrays of objects, and select items from an array based on sub-object keys.  See examples below for details.

### Examples

- **Monitor Expression**: `processes.list[.command == 'ffmpeg'].memRss`
- **Alert Expression**: `monitors.load_avg >= (cpu.cores + 1)`
- **Alert Message**: `Less than 5% of total memory is available ({{bytes(memory.available)}} of {{bytes(memory.total)}})`

### Object Property Names

You can use dot notation to access object properties with simple names, such as `params.timeout` or `data.color`.  If a property name contains a hyphen, space, or other special character, use bracket notation with the property name in quotes:

```text
params.timeout
params['a-number']
data.headers['x-uuid']
data['display name']
```

Both single and double quotes are supported inside the brackets.  For example, `params['a-number']` and `params["a-number"]` are equivalent.

Be careful not to use dot notation with a hyphenated property name.  JEXL interprets `params.a-number` as the subtraction expression `params.a - number`.  This rule also applies inside `{{ mustache }}` macros, so a hyphenated Plugin Parameter ID should be referenced like this:

```text
{{ params['a-number'] }}
```

## Disabling Macro Expansion

If your script or template uses `{{ ... }}` syntax for another tool, you can include the special marker `XY_NO_EXP` anywhere to disable xyOps macro expansion for the entire string.  This lets you keep your existing templates without escaping each macro individually.

For example, add a comment to a Shell Plugin script to preserve Docker's format templates:

```sh
#!/bin/sh

# XY_NO_EXP
docker ps -a --format '{{.ID}} {{.Names}}'
```

Use the comment syntax appropriate for your language.  For JavaScript, you can use `// XY_NO_EXP` or `/* XY_NO_EXP */`:

```js
// XY_NO_EXP
const template = 'Hello {{name}}!';
```

The marker is case-sensitive and must appear as a standalone token.  For example, `xy_no_exp` and `XY_NO_EXP_SUFFIX` do not activate the bypass.  xyOps recognizes the marker anywhere in the input text, including comments and quoted strings, and preserves the full string exactly as supplied, including the marker itself.

Other string templates that support macro expansion, such as Web Hook messages and email templates, can also use this marker.  Direct expressions, such as Monitor Expressions and Alert Trigger Expressions, continue to be evaluated normally.

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
| `total` | `total(array, key)` | Returns the sum of an array of numbers, or the numeric values at a specified key or dot path in an array of objects.  The `key` argument is optional. |
| `average` | `average(array, key)` | Returns the arithmetic mean of an array of numbers, or the numeric values at a specified key or dot path in an array of objects.  The `key` argument is optional. |
| `slice` | `slice(array, start, end)` | Returns a new array from the zero-based `start` index up to, but excluding, `end`.  Both indexes are optional. |

The `total` and `average` functions accept an array of numbers directly:

```text
total([10, 20, 30]) == 60
average([10, 20, 30]) == 20
```

For an array of objects, pass the sub-key name or dot path as the second argument.  The value at that key or path in each object is the number totaled or averaged.  For example, to calculate the total or average resident memory usage across processes matching "postgres":

```text
total( find(processes.list, 'command', 'postgres'), 'memRss' )
average( find(processes.list, 'command', 'postgres'), 'memRss' )
```

To select a nested value, use a quoted dot path.  For example, if each object in `items` contains a `stats` object with a numeric `size` property:

```text
total(items, 'stats.size')
average(items, 'stats.size')
```

All array elements, or the values selected by the key or dot path, should be numbers.  Both functions return `0` for an empty array.

The `slice` function defaults to the beginning of the array when you omit `start` and goes through the last item when you omit `end`.  Negative indexes count back from the end.  When passing a negative number directly as a JEXL argument, wrap it in parentheses, as in `(-2)`.

Try these calls with `items` set to `[10, 20, 30, 40]`.

- `slice(items, 1, 3)` returns `[20, 30]`.
- `slice(items, 2)` returns `[30, 40]`.
- `slice(items, (-2))` returns `[30, 40]`.

### Searching

| Function | Usage | Description |
|----------|-------|-------------|
| `find` | `find(array, key, value)` | Returns an array of objects whose value at the specified key or dot path contains the given substring. |
| `includes` | `includes(array, key)` | Find a substring in a string, or an element in an array. |
| `match` | `match(string, pattern)` | Perform a regex match on a string.  The pattern itself must also be specified as a string. |

The `find` function accepts a plain key, such as `'command'`, or a quoted dot path to a nested property.  For example, to select objects in `items` whose `details.name` value contains "backup":

```text
find(items, 'details.name', 'backup')
```

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
- [Custom Job Overrides](recipes.md#custom-job-overrides)
