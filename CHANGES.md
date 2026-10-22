# Changes

## 0.1.0 2026-10-22

* Seneca 4 support. Seneca 4.0.0 validates with
  [shape](https://github.com/rjrodger/shape), the renamed successor of
  Gubu, and rejects option defaults built with Gubu, so 0.0.4 stops the
  process at startup there (`plugin_gubu_shape`). The defaults are now
  a function of `{ valid }`, the builders Seneca passes to it: shape on
  Seneca 4.0.0, Gubu on Seneca 3 and 4.0.0-rc5. The options are
  unchanged.
* The gubu package is no longer imported. It was never a declared
  dependency, and was available only through Seneca's own dependency
  on it.
* Breaking: the entity plugin is `@seneca/entity` 29 or later, which
  replaces `seneca-entity`: the peer dependency `seneca-entity >=26` is
  now `@seneca/entity >=29`.
* Breaking: Seneca 3 support starts at 3.38. The peer range is
  `>=3.38||>=4.0.0-rc5` (was `>=3||>=4.0.0-rc2`).
* The repository now holds the 0.0.4 sources, which had been published
  without being committed.
* Tests: the entity plugin is loaded as `@seneca/entity`, and
  `resolveIndex` is tested with a message, including the `index$`
  directive. The development dependencies include `seneca ^4.0.0-rc5`
  and `@seneca/entity ^29.0.0`. The tests run against Seneca 4.0.0,
  4.0.0-rc5 and 3.38; two of them need an OpenSearch server
  (`SENECA_OPENSEARCH_TEST_NODE`).

## 0.0.4

Changes since 0.0.1, reconstructed from the published package:

* An `index$` directive names the index of an operation: `msg.index$`,
  `q.index$` or `q.directive$.index$`. `resolveIndex` takes the message
  instead of the entity.
* A vector query can be requested with `q.vector$`, as well as
  `msg.vector$` and `q.directive$.vector$`.
* Peers: `@seneca/entity-util >=3`, `seneca >=3||>=4.0.0-rc2`,
  `seneca-entity >=26`; newer dependencies.
