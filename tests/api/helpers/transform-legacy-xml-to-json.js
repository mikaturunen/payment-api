const chai = require('chai')
const fs = require('fs')
const path = require('path')

const should = chai.should()
const expect = chai.expect
const assert = chai.assert
const transformer = require('../../../build/api/helpers/transform-legacy-xml-to-json').default

const mockXmlLocation = path.join(__dirname, '../../../src/api/mocks/example-xml.xml')
process.env.NODE_ENV = 'test'

describe('Helper transforms the Checkout XML into valid JSON', () => {
  let testXml;

  before(done => {
    // Read in the test data from xml that we want to use for this to make sure the parser works as intended
    fs.readFile(mockXmlLocation, 'utf8', (error, fileContent) => {
      if (error) {
        done(error)
      } else {
        testXml = fileContent
        done()
      }
    })
  })

  describe('With complete response', _ => {
    it('Can be transformed into JSON', done => {
      // These values should be the same as the values in the XML given in '../../../src/api/mocks/example-xml.xml'
      // If the xml is changed, this test will automatically break as it cannot find the resolved properties from the json, obviously
      const expected = {
        payment: {
          id: '58552843',
          status: '1',
          stamp: '11111111',
          version: '0001',
          reference: '12344',
          language: 'FI',
          content: '1',
          deliveryDate: '20170602',
          type: '0',
          algorithm: '3',
          customer: {
            firstName: 'Keijo',
            lastName: '',
            email: ''
          },
          delivery: {
            streetAddress: 'Katutie 12',
            postalCode: '00100',
            city: 'Helsinki',
            country: 'FIN'
          }
        },
        merchant: {
          id: '375917',
          company: 'Testi Oy',
          vatId: '123456-7',
          name: 'Markkinointinimi',
          email: 'testi@checkout.fi',
          phone: '012-345 678'
        },
        buttons: []
      }

      transformer(testXml)
        .then(result => {
          // Lazy way of iterating over the different properties instead of writing million lines to do it
          let test = [
            'id', 'status', 'version', 'reference', 'language', 'content', 'deliveryDate', 'type', 'algorithm'
          ]
          .forEach(key => assert.equal(result.payment[key], expected.payment[key]))

          test = [
            'firstName', 'lastName', 'email'
          ]
          .forEach(key => assert.equal(result.payment.customer[key], expected.payment.customer[key]))

          test = [
            'streetAddress', 'postalCode', 'city', 'country'
          ]
          .forEach(key => assert.equal(result.payment.delivery[key], expected.payment.delivery[key]))

          test = [
            'id', 'company', 'vatId', 'name', 'email', 'phone'
          ]
          .forEach(key => assert.equal(result.merchant[key], expected.merchant[key]))

          assert.equal(result.buttons.list.map(form => form.name).indexOf('MobilePay'), 0)

          // TODO once we are confident in the JSON format, write additional tests for the json UiSchema

          done()
        })
        .catch(error => done(error))
    })
  })
})
