# Changesets

Every pull request that changes what users of the `codesaga` package see — commands, flags, output, the JSON contract — adds a changeset:

```bash
pnpm changeset
```

Pick `codesaga`, choose the bump (breaking JSON contract changes are `major`), and describe the change for the changelog. Private workspace packages (`@codesaga/*`) are bundled into `codesaga` and never versioned on their own.
