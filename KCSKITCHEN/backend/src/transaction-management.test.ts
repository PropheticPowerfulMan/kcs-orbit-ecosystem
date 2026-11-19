import {test} from 'node:test'
import assert from 'node:assert/strict'
import {transactionRevision} from './transaction-management.js'
const row={id:'tx',status:'CONFIRMED',subtotal:'10000',schoolSubsidy:'4000',total:'6000',paymentMode:'CREDIT',paymentStatus:'CREDIT',items:[{id:'a',productId:'one',quantity:'1',unitPriceAtPurchase:'7000',subtotal:'7000'},{id:'b',productId:'two',quantity:'1',unitPriceAtPurchase:'3000',subtotal:'3000'}]}
test('revision is stable when database returns the same lines in another order',()=>assert.equal(transactionRevision(row),transactionRevision({...row,items:[...row.items].reverse()})))
test('financial or workflow changes invalidate an earlier editor revision',()=>{for(const changed of [{total:'6001'},{schoolSubsidy:'2000'},{status:'VOIDED'},{paymentStatus:'PAID'},{paymentMode:'CASH'},{items:[{...row.items[0],quantity:'2'},row.items[1]]}])assert.notEqual(transactionRevision(row),transactionRevision({...row,...changed}))})
