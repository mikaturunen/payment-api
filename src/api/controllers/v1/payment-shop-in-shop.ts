
import { OpenPayment, ClientError, PaymentWall } from '../../../types'
import { clientErrors, serverErrors } from '../../helpers/errors'
import { preparePayment } from '../../helpers/payment-preparation'
import transformLegacyXmlToJson from '../../helpers/transform-legacy-xml-to-json'

import * as express from 'express'
import * as crypto from 'crypto'
import * as unirest from 'unirest'
import * as xml2js from 'xml2js'
import * as R from 'ramda'

export interface LegacyOpenPaymentSis {
  'CHECKOUT_XML': string
  'CHECKOUT_MAC': string
}

const VERSION = '0002'
const ALGORITHM = '3'
const xml = '10'
const DEVICE = xml
const TYPE = '0'

const bunyan = require('bunyan')
const log = bunyan.createLogger({ name: 'v1-payment-shop-in-shop' })

const successCodes = [ 200 ]
const checkoutError = [ 200 ]

// TODO handle this case as a fairly generic error after you've internally built structure to stop this from occurring in normal cases
// <p>Maksutapahtuman luonti ei onnistunut (-1).</p><p>Error in field/Virhekentässä: VERSION</p><p><a href=''>Palaa takaisin verkkokauppaan</a></p>

// TODO handle all the special cases that are actually considered errors even though they are HTTP 200 OK
const checkoutEmptyPostError = 'Yhtään tietoa ei siirtynyt POST:lla checkoutille'

/**
 * Creates an open payment for shop-in-shop case.
 *
 * @param {LegacyOpenPaymentSis} payload Request POST body
 * @param {Object} headers Complete unirest headers. Defaults to empty headers.
 * @returns {Promise} Resolves to payment wall and rejects on HTTP error or HTTP 200 OK when it's CoF specific error.
 */
const openPaymentWall = (payload: LegacyOpenPaymentSis, headers?: {[key: string]: string}): Promise<string> => {
  headers = headers ? headers : {}

  log.info(`Opening sis payment wall.`)

  return new Promise((resolve: any, reject: (error: ClientError) => void) => unirest
    .post('https://payment.checkout.fi')
    .headers(headers)
    .send(payload)
    .end((result: any) => {
        // TODO resolve promise needs a type that we communicate to the frontend.
      // TODO Conver the result XML content into a proper json object
      log.info(`Payment wall replied.. parsing reply`)
      // First make sure we have handled the http error codes
      if (successCodes.indexOf(result.code) === -1) {
        // ERROR
        log.error(`HTTP 1/1 error from parsing the reply ${result.code}.`)
        let clientError = serverErrors.legacy.error
        clientError.rawError = result.body
        reject(clientError)
      } else if (result.body === checkoutEmptyPostError) {
        // TODO handle the remaining  errors the payment wall can give inside a HTTP 200 OK-
        // TODO start using proper ClientError objects
        // HTTP status was okay but something was configured incorrectly or miscommunicated
        log.error('HTTP status was 200 but something was configured incorrectly or miscommunicated into v1:', result.body, result.code)
        let clientError = clientErrors.legacy.overlay
        clientError.rawError = result.body
        reject(clientError)
      } else {
        console.log('result from xml', result.body)
        resolve(result.body)
      }
    }))
}

/**
 * Transforms a valid json formatted payment object into a legacy format object that allows us to open the legacy payment wall.
 *
 * @param {string} merchantId ID of the Merchant, also known as 'mid'
 * @param {string} merchantSecret Shared secret for specific merchant.
 * @param {OpenPayment} payment The specific payment object.
 * @returns {LegacyOpenPaymentSis} Legacy payment sis object
 */
export const createLegacyOpenPayment = (merchantId: string, merchantSecret: string, payment: OpenPayment): LegacyOpenPaymentSis => {
  // TODO Clean up this string crap into a simple xml lib as soon as it's tested to work properly

  let rawXml = `<?xml version='1.0'?>
    <checkout xmlns='http://checkout.fi/request'>
      <request type='aggregator' test='false'>
        <aggregator>${merchantId}</aggregator>
        <version>${VERSION}</version>
        <stamp>${payment.stamp}</stamp>
        <reference>1501589373178</reference>
        <description>Test</description>
        <device>${DEVICE}</device>
        <content>${payment.content}</content>
        <type>${TYPE}</type>
        <algorithm>${ALGORITHM}</algorithm>
        <currency>${payment.currency}</currency>
        <commit>false</commit>
        <items>
        `

  payment.items.forEach(item => {
    // TODO item level control element, name it to something that makes more sense.

    rawXml = rawXml + `<item>
            <code>${item.categoryCode}</code>
            <stamp>${item.stamp}</stamp>
            <description>${item.description}</description>
            <price currency='${payment.currency}' vat='${item.vatPercentage}'>${item.amount}</price>
            <merchant>${item.merchant.id}</merchant>
            <control></control>
            <reference>${item.reference}</reference>
          </item>
          `
  })

  rawXml = rawXml + `<amount currency="${payment.currency}">${payment.totalAmount}</amount>`

  // TODO fix delivery.date element from payment.items[0].deliveryDate to be payment.delivery.date as the legacy api requires this.
  rawXml = rawXml + `</items>
        <buyer vatid=''>
          <firstname>${payment.customer.firstName}</firstname>
          <familyname>${payment.customer.lastName}</familyname>
          <address> </address>
          <postalcode> </postalcode>
          <postaloffice> </postaloffice>
          <country>${payment.country}</country>
          <email>${payment.customer.email}</email>
          <gsm> </gsm>
          <language>${payment.language}</language>
        </buyer>
        <delivery>
          <date>${payment.items[0].deliveryDate}</date>
          <company vatid=""></company>
          <firstname>${payment.customer.firstName}</firstname>
          <familyname>${payment.customer.lastName}</familyname>
          <address> </address>
          <postalcode> </postalcode>
          <postaloffice> </postaloffice>
          <country>${payment.country}</country>
          <email>${payment.customer.email}</email>
          <gsm> </gsm>
          <language>${payment.language}</language>
        </delivery>
        <control type="default">
          <return>${payment.redirect.return}</return>
          <reject>${payment.redirect.reject}</reject>
          <cancel>${payment.redirect.cancel}</cancel>
          <delayed>${payment.redirect.delayed}</delayed>
        </control>
      </request>
    </checkout>
  `

  // TODO mask all person specific information from the log files with per property:
  // foo.substring(0, 2) + foo.substring(2, foo.length-2).replace(/\S/gi, '*') + foo.substring(foo.length-2, foo.length)
  // other option is to just drop out the elements from the log file that we do not want but this might make the problem solving effort more difficult later on in production for customer service
  log.info(`Sending out the following raw XML: \n${rawXml}`)

  const xml = new Buffer(
      rawXml
    )
    .toString('base64')

  log.info(`Base64 of that XML: \n${xml}`)

  const query = [
    xml,
    merchantSecret
  ]
  .join('+')

  // NOTE unfortunately the legacy API uses MD5 in these cases but we hide it behind our own hashing algorithm
  const hmac = crypto.createHash('md5')
    .update(query)
    .digest('hex')
    .toUpperCase()

  return {
    'CHECKOUT_XML': xml,
    'CHECKOUT_MAC': hmac
  }
}

/**
 * Attempts to run all the validations that we know are in place in the v1 API before we actually call it and give out sensible errors.
 *
 * @param {LegacyOpenPayment} payment Payment object
 * @returns {Promise} Resolves into a LegacyOpenPayment object and on validation errors rejects into set of errors that are client friendly
 */
export const v1SpecificValidations = (payment: LegacyOpenPaymentSis) => new Promise(
  (resolve: (payment: LegacyOpenPaymentSis) => void, reject: (error: ClientError) => void) => {
    const capturesValidationErrors: ClientError[] = []

    // TODO keep adding validations from the existing set

    if (capturesValidationErrors.length > 0) {
      let error = clientErrors.invalidPaymentProperties
      // attach all the legacy validation errors we found into the error object so the calling client knows exactly what's going on
      error.rawError = capturesValidationErrors
      reject(clientErrors.invalidPaymentProperties)
    } else {
      resolve(payment)
    }
  }
)

// TODO remove completel once we are done with tests, this is not required at all.
const SECRET = 'SAIPPUAKAUPPIAS'

/**
 * Express rest api handler for v1 shop-in-shop payments. Wraps the payment into a much more convenient format that is more user friendly to use.
 * Follows exactly the same object schema as the v2. Just transformed into v1 and most of the content is ignored if it's not present in v1.
 *
 * @param {express.Request} request Express request
 * @param {express.Response} response Express response
 */
export const openPayment = (request: express.Request, response: express.Response) => {
  log.info(`start openPayment for shop-in-shop.. finding merchant`)

  const openPayment: OpenPayment = request.body.payment
  const merchantId: string = request.body.merchantId
  const clientHmac: string = request.body.hmac
  // TODO: read secret from db for merchant
  const merchantSecret = SECRET

  log.info(`Found merchant for shop-in-shop openPayment, merchant ${merchantId}`)

  preparePayment(merchantId, merchantSecret, clientHmac, openPayment)
    .then(paymentSet => createLegacyOpenPayment(paymentSet.merchantId, paymentSet.merchantSecret, paymentSet.payment))
    .then(payment => v1SpecificValidations(payment))
    .then(payment => openPaymentWall(payment))
    .then(paymentWallXml => transformLegacyXmlToJson(paymentWallXml))
    .then(paymentWall => {
      response.json(paymentWall)
      log.info(`end openPayment for shop-in-shop, OK`)
    })
    .catch((error: ClientError) => {
      if (!error.http || !error.code) {
        log.error(`Unhandled error in openPayment for shop-in-shop: `, error)
        // TODO list this error into an alarm list that the developers will follow and fix as these emerge
        response.status(502).json(serverErrors.general)
      } else {
        log.error(`Error in openPayment for shop-in-shop: `, error)
        response.status(error.http).json(error)
      }
    })
}
