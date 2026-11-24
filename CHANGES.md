# Changes

## 0.1.0 2026-11-21

* Seneca 4 only: the peer dependencies are `seneca` `^4.0.0` and
  `@seneca/entity` `^29.0.0`. Seneca 3 users stay on 0.0.4.
* Breaking: the entity plugin is `@seneca/entity` 29, which replaces
  `seneca-entity` (the peer was `seneca-entity >=26`).
* Node.js 24 or later (`engines.node` `>=24`).
* Seneca 4.0.0 validates options with
  [shape](https://github.com/rjrodger/shape) and rejects option defaults
  built with Gubu, so 0.0.4 stops at startup there
  (`plugin_gubu_shape`). The defaults are now a function of `{ valid }`,
  the builders Seneca passes to it (B1). The options are unchanged.
* The gubu package is no longer imported. It was never a declared
  dependency, and was available only through Seneca's own dependency
  on it.
* No `seneca-promisify` or `@seneca/entity-util` peer: Seneca 4 has the
  promise API built in, and the plugin does not use the entity
  utilities.
* The repository now holds the 0.0.4 sources and the history of the
  0.0.2 to 0.0.4 releases.
* Tests: the entity plugin is loaded as `@seneca/entity`, and
  `resolveIndex` is tested with a message, including the `index$`
  directive. The live tests skip without `SENECA_OPENSEARCH_TEST_NODE`.
  They ran against a local OpenSearch 3.10 node with the k-NN plugin,
  not against AWS OpenSearch Serverless.

## 0.0.4

Changes since 0.0.1, reconstructed from the published package:

* An `index$` directive names the index of an operation: `msg.index$`,
  `q.index$` or `q.directive$.index$`. `resolveIndex` takes the message
  instead of the entity.
* A vector query can be requested with `q.vector$`, as well as
  `msg.vector$` and `q.directive$.vector$`.
* Peers: `@seneca/entity-util >=3`, `seneca >=3||>=4.0.0-rc2`,
  `seneca-entity >=26`; newer dependencies.
