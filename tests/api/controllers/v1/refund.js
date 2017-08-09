const chai = require('chai')
const chaiHttp = require('chai-http')
const server = require('../../../../build/app')
const should = chai.should()
const crypto = require('crypto')
const expect = chai.expect

chai.use(chaiHttp)

process.env.NODE_ENV = 'test'

describe('Legacy refund wrapper', () => {
  describe('POST /v1/payment/refund', _ => {
    it('with empty refund', done => {
      const payment = {
      }

      chai
        .request(server)
        .post('/v1/payment/refund')
        .send(payment)
        .end((error, response) => {
          response.status.should.eql(400)
          done()
        })
    })

    it('with a valid payment', done => {
      let body = require('../../../../src/api/mocks/refund.json')

      console.log('body to post')
      console.log(JSON.stringify(body, null, 2))

      body.hmac = crypto
       .createHmac('sha256', 'SAIPPUAKAUPPIAS')
       .update(new Buffer(JSON.stringify(body.payment)).toString('base64'))
       .digest('hex')
       .toUpperCase()

      chai
        .request(server)
        .post('/v1/payment/refund')
        .set('Accepts', 'application/json')
        .send(body)
        .end((error, response) => {
          console.log('ERROR', error)
          console.log(JSON.stringify(response.body, null, 2))
          response.status.should.eql(200)
          response.body.should.be.a('object')

          const payment = response.body
          expect(payment).to.have.property('merchant')
          expect(payment.merchant).to.have.property('id').to.equal('375917')
          expect(payment.buttons.list.length).to.have.above(3)

          done()
        })
    })
  })
})
