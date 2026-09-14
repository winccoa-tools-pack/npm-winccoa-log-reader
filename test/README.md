# Tests

## Unit

```shell
npm run test:unit
```

No WinCC OA install required. Fixtures live under `test/fixtures/`.

## Integration

```shell
npm run build
npm run test:integration
```

Spawns the built (or TS) CLI against the sample log.

## Full gate

```shell
npm test
```

Runs style-check, build, and unit tests.
