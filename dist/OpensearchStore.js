"use strict";
/* Copyright (c) 2024 Seneca contributors, MIT License */
Object.defineProperty(exports, "__esModule", { value: true });
const aws_1 = require("@opensearch-project/opensearch/aws");
const opensearch_1 = require("@opensearch-project/opensearch");
const credential_provider_node_1 = require("@aws-sdk/credential-provider-node");
const gubu_1 = require("gubu");
const { Open, Any } = gubu_1.Gubu;
function OpensearchStore(options) {
    const seneca = this;
    const init = seneca.export('entity/init');
    let desc = 'OpensearchStore';
    let client;
    let store = {
        name: 'OpensearchStore',
        save: function (msg, reply) {
            // const seneca = this
            const ent = msg.ent;
            const canon = ent.canon$({ object: true });
            const index = resolveIndex(ent, options);
            const body = ent.data$(false);
            const fieldOpts = options.field;
            ['zone', 'base', 'name']
                .forEach((n) => {
                if ('' != fieldOpts[n].name && null != canon[n] && '' != canon[n]) {
                    body[fieldOpts[n]] = canon[n];
                }
            });
            const req = {
                index,
                body,
            };
            client.index(req)
                .then((res) => {
                const body = res.body;
                ent.data$(body._source);
                ent.id = body._id;
                reply(ent);
            })
                .catch((err) => reply(err));
        },
        load: function (msg, reply) {
            // const seneca = this
            const ent = msg.ent;
            // const canon = ent.canon$({ object: true })
            const index = resolveIndex(ent, options);
            let q = msg.q || {};
            if (null != q.id) {
                client.get({
                    index,
                    id: q.id
                })
                    .then((res) => {
                    const body = res.body;
                    ent.data$(body._source);
                    ent.id = body._id;
                    reply(ent);
                })
                    .catch((err) => {
                    // Not found
                    if (err.meta && 404 === err.meta.statusCode) {
                        reply(null);
                    }
                    reply(err);
                });
            }
            else {
                reply();
            }
        },
        list: function (msg, reply) {
            var _a;
            // const seneca = this
            const ent = msg.ent;
            // const canon = ent.canon$({ object: true })
            const index = resolveIndex(ent, options);
            let q = msg.q || {};
            let query = {
                index,
                body: {
                    size: msg.size$ || options.cmd.list.size,
                    _source: {
                        excludes: [options.field.vector.name].filter(n => '' !== n)
                    },
                    query: {},
                }
            };
            let excludeKeys = { directive$: 1, vector: 1 };
            for (let k in q) {
                if (!excludeKeys[k]) {
                    query.body.query.match = (query.body.query.match || {});
                    query.body.query.match[k] = q[k];
                }
            }
            if (msg.vector$ || ((_a = q.directive$) === null || _a === void 0 ? void 0 : _a.vector$)) {
                query.body.query.knn = {
                    vector: { vector: q.vector, k: 15 }
                };
            }
            // console.log('QUERY', query)
            if (0 === Object.keys(query.body.query).length) {
                return reply([]);
            }
            client
                .search(query)
                .then((res) => {
                const hits = res.body.hits;
                const list = hits.hits.map((entry) => {
                    let item = ent.make$().data$(entry._source);
                    item.id = entry._id;
                    item.custom$({ score: entry._score });
                    return item;
                });
                reply(list);
            })
                .catch((err) => {
                reply(err);
            });
        },
        remove: function (msg, reply) {
            // const seneca = this
            const ent = msg.ent;
            // const canon = ent.canon$({ object: true })
            const index = resolveIndex(ent, options);
            let q = msg.q || {};
            if (null != q.id) {
                client.delete({
                    index,
                    id: q.id
                })
                    .then((_res) => {
                    reply(null);
                })
                    .catch((err) => {
                    // Not found
                    if (err.meta && 404 === err.meta.statusCode) {
                        reply(null);
                    }
                    reply(err);
                });
            }
            else {
                reply();
            }
        },
        close: function (_msg, reply) {
            this.log.debug('close', desc);
            reply();
        },
        native: function (_msg, reply) {
            reply(null, {
                client: () => client
            });
        },
    };
    let meta = init(seneca, options, store);
    desc = meta.desc;
    seneca.prepare(async function () {
        const region = options.aws.region;
        const node = options.opensearch.node;
        client = new opensearch_1.Client({
            ...(0, aws_1.AwsSigv4Signer)({
                region,
                service: 'aoss',
                getCredentials: () => {
                    const credentialsProvider = (0, credential_provider_node_1.defaultProvider)();
                    return credentialsProvider();
                }
            }),
            node
        });
    });
    return {
        name: store.name,
        tag: meta.tag,
        exportmap: {
            native: () => ({
                client
            })
        },
    };
}
function resolveIndex(ent, options) {
    let indexOpts = options.index;
    if ('' != indexOpts.exact && null != indexOpts.exact) {
        return indexOpts.exact;
    }
    let canonstr = ent.canon$({ string: true });
    indexOpts.map = indexOpts.map || {};
    if ('' != indexOpts.map[canonstr] && null != indexOpts.map[canonstr]) {
        return indexOpts.map[canonstr];
    }
    let prefix = indexOpts.prefix;
    let suffix = indexOpts.suffix;
    prefix = ('' == prefix || null == prefix) ? '' : prefix + '_';
    suffix = ('' == suffix || null == suffix) ? '' : '_' + suffix;
    // TOOD: need ent.canon$({ external: true }) : foo/bar -> foo_bar
    let infix = ent.canon$({ string: true }).replace(/-\//g, '').replace(/\//g, '_');
    return prefix + infix + suffix;
}
// Default options.
const defaults = {
    debug: false,
    map: Any(),
    index: {
        prefix: '',
        suffix: '',
        map: {},
        exact: '',
    },
    // '' === name => do not inject
    field: {
        zone: { name: 'zone' },
        base: { name: 'base' },
        name: { name: 'name' },
        vector: { name: 'vector' },
    },
    cmd: {
        list: {
            size: 11,
        },
    },
    aws: Open({
        region: 'us-east-1'
    }),
    opensearch: Open({
        node: 'NODE-URL',
    }),
};
Object.assign(OpensearchStore, {
    defaults,
    utils: { resolveIndex },
});
exports.default = OpensearchStore;
if ('undefined' !== typeof module) {
    module.exports = OpensearchStore;
}
//# sourceMappingURL=OpensearchStore.js.map