/* Copyright © 2024 Seneca Project Contributors, MIT License. */

require('dotenv').config({ path: '.env.local' })
// console.log(process.env) // remove this


import Seneca from 'seneca'
// import SenecaMsgTest from 'seneca-msg-test'
// import { Maintain } from '@seneca/maintain'

import { Client } from '@opensearch-project/opensearch'
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws'
import { defaultProvider } from '@aws-sdk/credential-provider-node'

import OpensearchStoreDoc from '../src/OpensearchStoreDoc'
import OpensearchStore from '../src/OpensearchStore'


const OPENSEARCH_NODE = process.env.SENECA_OPENSEARCH_TEST_NODE
const OPENSEARCH_INDEX = process.env.SENECA_OPENSEARCH_TEST_INDEX
const testLive = OPENSEARCH_NODE ? test : test.skip

// The live tests (insert-remove, vector-cat) need SENECA_OPENSEARCH_TEST_NODE, and skip
// without it. They run against AWS OpenSearch Serverless (aoss) or a local OpenSearch node
// with the k-NN plugin (security off, plain HTTP), such as the test services container:
//
//   SENECA_OPENSEARCH_TEST_NODE=http://127.0.0.1:19200
//
// The two differ, and the plugin is written for aoss:
// * aoss: the vector index of the collection is normally created beforehand; name it with
//   SENECA_OPENSEARCH_TEST_INDEX. There is no refresh call: a write becomes searchable after
//   the collection's refresh interval, 5 s for NextGen and 60 s for Classic vector
//   collections, so set SENECA_OPENSEARCH_TEST_WAIT (ms, default 2222) to match.
// * Local node: without SENECA_OPENSEARCH_TEST_INDEX the tests create a fresh k-NN index
//   for this run and delete it afterwards (an index named by SENECA_OPENSEARCH_TEST_INDEX
//   that does not exist yet is also created, and kept). The node refreshes every second.
// The plugin always signs requests with SigV4 for the aoss service. A local node ignores the
// signature, but the signer needs credentials, so for a local node the tests set dummy AWS
// credentials when none are in the environment.
const OPENSEARCH_WAIT = Number(process.env.SENECA_OPENSEARCH_TEST_WAIT) || 2222
const LIVE_TIMEOUT = 22222 + 2 * OPENSEARCH_WAIT

const OPENSEARCH_LOCAL =
  null != OPENSEARCH_NODE &&
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(OPENSEARCH_NODE)

if (OPENSEARCH_LOCAL) {
  process.env.AWS_ACCESS_KEY_ID ??= 'test'
  process.env.AWS_SECRET_ACCESS_KEY ??= 'test'
  process.env.AWS_REGION ??= 'us-east-1'
}

const testIndex: string =
  OPENSEARCH_INDEX ||
  'opensearch-store-test-' + Date.now().toString(36) + '-' + process.pid

let createdIndex = false



describe('OpensearchStore', () => {
  beforeAll(async () => {
    if (!OPENSEARCH_NODE) return
    const client = makeClient()
    const exists = await client.indices.exists({ index: testIndex })
    if (!exists.body) {
      await client.indices.create({ index: testIndex, body: index_test01 })
      createdIndex = true
    }
  }, 22222)

  afterAll(async () => {
    if (createdIndex && !OPENSEARCH_INDEX) {
      await makeClient().indices.delete({ index: testIndex })
    }
  }, 22222)


  test('load-plugin', async () => {
    expect(OpensearchStore).toBeDefined()
    expect(OpensearchStoreDoc).toBeDefined()

    const seneca = Seneca({ legacy: false })
      .test()
      .use('@seneca/entity')
      .use(OpensearchStore)
    await seneca.ready()

    expect(seneca.export('OpensearchStore/native')).toBeDefined()
  })


  test('utils.resolveIndex', () => {
    const utils = OpensearchStore['utils']
    const resolveIndex = utils.resolveIndex
    const seneca = makeSeneca()
    const ent0 = seneca.make('foo')
    const ent1 = seneca.make('foo/bar')

    expect(resolveIndex({ ent: ent0 }, { index: {} })).toEqual('foo')
    expect(resolveIndex({ ent: ent0 }, { index: { exact: 'qaz' } })).toEqual('qaz')

    expect(resolveIndex({ ent: ent1 }, { index: {} })).toEqual('foo_bar')
    expect(resolveIndex({ ent: ent1 }, { index: { prefix: 'p0', suffix: 's0' } })).toEqual('p0_foo_bar_s0')
    expect(resolveIndex({ ent: ent1 }, {
      index: { map: { '-/foo/bar': 'FOOBAR' }, prefix: 'p0', suffix: 's0' }
    }))
      .toEqual('FOOBAR')

    // An index$ directive names the index, whatever the options say.
    const exact = { index: { exact: 'qaz' } }
    expect(resolveIndex({ ent: ent1, index$: 'i0' }, exact)).toEqual('i0')
    expect(resolveIndex({ ent: ent1, q: { index$: 'i1' } }, exact)).toEqual('i1')
    expect(resolveIndex({ ent: ent1, q: { directive$: { index$: 'i2' } } }, exact))
      .toEqual('i2')
  }, 22222)


  testLive('insert-remove', async () => {
    const seneca = await makeSeneca()
    await seneca.ready()


    // no query params means no results
    const list0 = await seneca.entity('foo/chunk').list$()
    expect(0 === list0.length)

    const list1 = await seneca.entity('foo/chunk').list$({ test: 'insert-remove' })
    // console.log(list1)

    let ent0: any

    if (0 === list1.length) {
      ent0 = await seneca.entity('foo/chunk')
        .make$()
        .data$({
          test: 'insert-remove',
          text: 't01',
          vector: [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7],
          directive$: { vector$: true },
        })
        .save$()
      expect(ent0).toMatchObject({ test: 'insert-remove' })
      await new Promise((r) => setTimeout(r, OPENSEARCH_WAIT))
    }
    else {
      ent0 = list1[0]
    }

    await seneca.entity('foo/chunk').remove$(ent0.id)

    await new Promise((r) => setTimeout(r, OPENSEARCH_WAIT))

    const list2 = await seneca.entity('foo/chunk').list$({ test: 'insert-remove' })
    // console.log(list2)
    expect(list2.filter((n: any) => n.id === ent0.id)).toEqual([])
  }, LIVE_TIMEOUT)


  testLive('vector-cat', async () => {
    const seneca = await makeSeneca()
    await seneca.ready()

    // const list0 = await seneca.entity('foo/chunk').list$({ test: 'vector-cat' })
    // console.log('list0', list0)

    // NOT AVAILABLE ON AWS
    // await seneca.entity('foo/chunk').remove$({ all$: true, test: 'vector-cat' })

    const list1 = await seneca.entity('foo/chunk').list$({ test: 'vector-cat' })
    // console.log('list1', list1)

    /*
    for (let i = 0; i < list1.length; i++) {
      await list1[i].remove$()
    }

    await new Promise((r) => setTimeout(r, OPENSEARCH_WAIT))

    const list1r = await seneca.entity('foo/chunk').list$({ test: 'vector-cat' })
    // console.log('list1r', list1r)
    */

    if (!list1.find((n: any) => 'code0' === n.code)) {
      await seneca.entity('foo/chunk')
        .make$()
        .data$({
          code: 'code0',
          test: 'vector-cat',
          text: 't01',
          vector: [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
          directive$: { vector$: true },
        })
        .save$()
    }

    if (!list1.find((n: any) => 'code1' === n.code)) {
      await seneca.entity('foo/chunk')
        .make$()
        .data$({
          code: 'code1',
          test: 'vector-cat',
          text: 't01',
          vector: [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
          directive$: { vector$: true },
        })
        .save$()
    }

    await new Promise((r) => setTimeout(r, OPENSEARCH_WAIT))

    const list2 = await seneca.entity('foo/chunk').list$({
      directive$: { vector$: { k: 2 } },
      vector: [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
    })
    // console.log('list2', list2.map((n: any) => ({ ...n })))
    expect(1 < list2.length).toEqual(true)

    const list3 = await seneca.entity('foo/chunk').list$({
      directive$: { vector$: { k: 2 } },
      vector: [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
      code: 'code0'
    })
    // console.log('list3', list3.map((n: any) => ({ ...n })))
    expect(list3.length).toEqual(1)

  }, LIVE_TIMEOUT)



})


function makeSeneca() {
  return Seneca({ legacy: false })
    .test()
    .use('@seneca/entity')
    .use(OpensearchStore, {
      map: {
        'foo/chunk': '*'
      },
      index: {
        exact: testIndex,
      },
      opensearch: {
        node: OPENSEARCH_NODE,
      }
    })
}


function makeClient() {
  return new Client({
    ...AwsSigv4Signer({
      region: process.env.AWS_REGION || 'us-east-1',
      service: 'aoss',
      getCredentials: () => defaultProvider()(),
    }),
    node: OPENSEARCH_NODE as string,
  })
}


// k-NN index for the live tests, created only when the index does not exist (see above).
// The mapping names no engine or method, so that each service applies its own default
// (aoss Classic collections do not support the lucene engine, and OpenSearch 3 no longer
// creates nmslib indexes).
const index_test01 = {
  mappings: {
    properties: {
      text: { type: 'text' },
      vector: {
        type: 'knn_vector',
        dimension: 8, // 1536,
      },
    },
  },
  settings: {
    index: {
      knn: true,
    },
  },
}


/*
  [
  {
    "Rules": [
      {
        "Resource": [
          "collection/podmind03a"
        ],
        "Permission": [
          "aoss:CreateCollectionItems",
          "aoss:DeleteCollectionItems",
          "aoss:UpdateCollectionItems",
          "aoss:DescribeCollectionItems"
        ],
        "ResourceType": "collection"
      },
      {
        "Resource": [
          "index/podmind03a/*"
        ],
        "Permission": [
          "aoss:CreateIndex",
          "aoss:DeleteIndex",
          "aoss:UpdateIndex",
          "aoss:DescribeIndex",
          "aoss:ReadDocument",
          "aoss:WriteDocument"
        ],
        "ResourceType": "index"
      }
    ],
    "Principal": [
      "arn:aws:iam::...:role/...LambdaRole..."
    ],
    "Description": "Easy data policy"
  }
]
  */
