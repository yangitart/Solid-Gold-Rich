# Data Model: Loading Feedback for Large Imports

## FileAsset

Transient metadata returned after system document selection.

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `uri` | string | yes | System-selected local/cache URI readable by the file adapter. |
| `name` | string | yes | Original provider filename used for format routing. |
| `size` | number | no | Byte count when reported by the provider; must not be assumed present. |

## Import operation state

Presentation-only lifecycle; it is not persisted in `AppState`.

```text
idle -> selecting -> loading -> awaiting-confirmation -> restoring -> completed
                   |              |                    |
                   `-> failed     `-> cancelled         `-> failed

selecting -> cancelled
```

### Invariants

- `loading` or `restoring` maps to a visible blocking modal.
- Every terminal path returns to `idle` and hides the modal.
- No imported application state is committed before validation and, where required, confirmation.
- File size affects only loading preparation; it never bypasses validation or confirmation.
