const chai = require('chai')
const fs = require('fs')
const crypto = require('crypto')

const should = chai.should()
const expect = chai.expect
const assert = chai.assert
const isHmacValid = require('../../../build/api/helpers/hmac-validator').default

process.env.NODE_ENV = 'test'

describe('Helper hmac validation', () => {
  const merchantSecret = 'magic-unicorns-of-fantasy-shoot-fire-and-steam-from-their-eyes'

  describe('True when', _ => {
    let clientHmac
    let payload = 'testing+foo+bar'

    before(done => {
      clientHmac = crypto
        .createHmac('sha256', merchantSecret)
        .update(new Buffer(JSON.stringify(payload)).toString('base64'))
        .digest('hex')
        .toUpperCase()
      done()
    })

    it('Validation matches on sha256 with correct merchant shared secret', () => assert.isTrue(
      isHmacValid(clientHmac, merchantSecret, payload)
    ))
  })

  describe('False when the validation', () => {
    let clientHmac
    let payload = 'testing+foo+bar'
    let wrongPayload = 'testing-foo-bar'
    let wrongMerchantSecret = 'magic-unicorns-of-fantasy-do-not-shoot-fire-and-steam-from-their-eyes'

    before(done => {
      clientHmac = crypto
        .createHmac('sha256', merchantSecret)
        .update(new Buffer(JSON.stringify(payload)).toString('base64'))
        .digest('hex')
        .toUpperCase()
      done()
    })

    it('Does not match on sha256 with incorrect merchant shared secret', () => assert.isFalse(
      isHmacValid(clientHmac, wrongMerchantSecret, payload)
    ))

    it('Does not match on sha256 with incorrect payload', () => assert.isFalse(
      isHmacValid(clientHmac, merchantSecret, wrongPayload)
    ))
  })
})
