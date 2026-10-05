# uuid

> UUIDv7 generation and the Uuid25 encoding, with no dependency

Internal to the erd-editor monorepo. It is not published to npm; other packages depend on
it as `"@dineug/uuid": "workspace:*"`.

## Usage

```ts
import { createUuidv7, toUuid25, uuid25, uuidv7 } from '@dineug/uuid';

uuid25(); // '03gzrxjv20bdlcak89q25d2m7' — a UUIDv7 as 25 base 36 digits

const bytes = uuidv7(); // Uint8Array(16), RFC 9562 version 7
toUuid25(bytes); // the same 25-digit form

// A generator of its own, with a fixed clock and random source for a test.
const next = createUuidv7({
  now: () => 1_700_000_000_000,
  random: words => words.fill(0),
});
```

## UUIDv7

48 bits of Unix milliseconds, the version, a 42-bit counter and 32 random bits. A new
millisecond seeds the counter with random bits; the same or an earlier one counts it up,
so each UUID one generator hands out sorts after the one before.

## Uuid25

[Uuid25](https://github.com/uuid25/javascript) writes the 128 bits of a UUID as 25
lowercase base 36 digits, zero padded, so the strings sort as the bytes do:
`8da942a4-1fbe-4ca6-852c-95c473229c7d` is `8dx554y5rzerz1syhqsvsdw8t`.
