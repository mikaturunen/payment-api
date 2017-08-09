
import { OpenPayment, ClientError, PaymentWall } from '../../../types'
import { clientErrors, serverErrors } from '../../helpers/errors'
import { preparePayment } from '../../helpers/payment-preparation'
import transformLegacyXmlToJson from '../../helpers/transform-legacy-xml-to-json'
import toValueString from '../../helpers/value-stringifier'

import * as express from 'express'
import * as crypto from 'crypto'
import * as unirest from 'unirest'
import * as xml2js from 'xml2js'
import * as R from 'ramda'

interface LegacyOpenPayment {
  VERSION: string
  STAMP: string
  AMOUNT: number
  REFERENCE: string
  MERCHANT: string
  RETURN: string
  CANCEL: string
  REJECT: string
  DEVICE: string
  DELAYED: string
  DELIVERY_DATE: string
  MESSAGE: string
  LANGUAGE: string
  COUNTRY: string
  CURRENCY: string
  CONTENT: string
  ALGORITHM: string
  TYPE: string
  FIRSTNAME: string
  FAMILYNAME: string
  ADDRESS: string
  POSTCODE: string
  POSTOFFICE: string
  EMAIL: string
  DESCRIPTION: string
  SECRET_KEY: string
  MAC?: string
}

const VERSION = '0001'
const ALGORITHM = '3'
const xml = '10'
const DEVICE = xml
const TYPE = '0'

const bunyan = require('bunyan')
const log = bunyan.createLogger({ name: 'v1-payment' })

/**
 * Transforms a valid json formatted payment object into a legacy format object that allows us to open the legacy payment wall.
 *
 * @param {string} merchantId ID of the Merchant, also known as 'mid'
 * @param {string} merchantSecret Shared secret for specific merchant.
 * @param {OpenPayment} openPayment The specific payment object.
 * @returns {LegacyOpenPayment} Object that can be used together with Checkouts existing payment wall.
 */
const createLegacyOpenPayment = (merchantId: string, merchantSecret: string, openPayment: OpenPayment): LegacyOpenPayment => {
  const item = openPayment.items[0]
  if (!item) {
    // we should never really hit this but IF we hit it..
    throw 'No item in place.'
  }

  const legacyOpenPayment: LegacyOpenPayment = {
    VERSION,
    STAMP: openPayment.stamp,
    AMOUNT: openPayment.totalAmount,
    REFERENCE: openPayment.reference,
    MESSAGE: openPayment.message,
    LANGUAGE: openPayment.language,
    MERCHANT: merchantId,
    RETURN: openPayment.redirect.return,
    CANCEL: openPayment.redirect.cancel,
    REJECT: openPayment.redirect.reject,
    DELAYED: openPayment.redirect.delayed,
    // TODO: decide on should it be item level in case of legacy payment of payment level..
    DELIVERY_DATE: item.deliveryDate,
    COUNTRY: openPayment.country,
    CURRENCY: openPayment.currency,
    DEVICE,
    CONTENT: openPayment.content,
    ALGORITHM,
    TYPE,
    FIRSTNAME: openPayment.customer.firstName,
    FAMILYNAME: openPayment.customer.lastName,
    ADDRESS: openPayment.delivery.streetAddress,
    POSTCODE: openPayment.delivery.postalCode,
    POSTOFFICE: openPayment.delivery.city,
    EMAIL: openPayment.customer.email,
    DESCRIPTION: item.description,
    SECRET_KEY: merchantSecret
  }

  const values = toValueString<LegacyOpenPayment>(
    legacyOpenPayment,
    [
      'VERSION', 'STAMP', 'AMOUNT', 'REFERENCE', 'MESSAGE', 'LANGUAGE', 'MERCHANT', 'RETURN', 'CANCEL', 'REJECT',
      'DELAYED', 'COUNTRY', 'CURRENCY', 'DEVICE', 'CONTENT', 'TYPE', 'ALGORITHM', 'DELIVERY_DATE', 'FIRSTNAME', 'FAMILYNAME',
      'ADDRESS', 'POSTCODE', 'POSTOFFICE', 'SECRET_KEY'
    ],
    '+'
  )

  // the old payment wall uses md5...
  legacyOpenPayment.MAC = crypto.createHash('md5')
    .update(values)
    .digest('hex')
    .toUpperCase()

  if (process.env['NODE_ENV'] === 'test') {
    console.log('values:', values)
    console.log('hmac:', legacyOpenPayment.MAC)
  }

  return legacyOpenPayment
}

const successCodes = [ 200 ]
const checkoutError = [ 200 ]

// TODO handle all the special cases that are actually considered errors even though they are HTTP 200 OK
const checkoutEmptyPostError = 'Yhtään tietoa ei siirtynyt POST:lla checkoutille'

/**
 * Creates an open payment.
 *
 * @param {LegacyOpenPayment} payload Request POST body
 * @param {Object} headers Complete unirest headers. Defaults to empty headers.
 * @returns {Promise} Resolves to payment wall and rejects on HTTP error or HTTP 200 OK when it's CoF specific error.
 */
const openPaymentWall = (payload: LegacyOpenPayment, headers?: {[key: string]: string}): Promise<string>  => {
  headers = headers ? headers : {}

  log.info(`Opening payment wall.`)

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
 * Attempts to run all the validations that we know are in place in the v1 API before we actually call it and give out sensible errors.
 *
 * @param {LegacyOpenPayment} payment Payment object
 * @returns {Promise} Resolves into a LegacyOpenPayment object and on validation errors rejects into set of errors that are client friendly
 */
const v1SpecificValidations = (payment: LegacyOpenPayment) => new Promise(
  (resolve: (payment: LegacyOpenPayment) => void, reject: (error: ClientError) => void) => {
    const capturesValidationErrors: ClientError[] = []
    // one of the legacy quirks
    if (payment.AMOUNT <= 0.01) {
      capturesValidationErrors.push(clientErrors.legacy.amount)
    }

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

// TODO remove completely once we are done with tests, this is not required at all.
const SECRET = 'SAIPPUAKAUPPIAS'

/**
 * Express rest api handler for v1 payments. Wraps the payment into a much more convenient format that is more user friendly to use.
 * Follows exactly the same object schema as the v2. Just transformed into v1 and most of the content is ignored if it's not present in v1.
 *
 * @param {express.Request} request Express request
 * @param {express.Response} response Express response
 */
export const openPayment = (request: express.Request, response: express.Response) => {
  log.info(`start openPayment.. finding merchant`)

  const openPayment: OpenPayment = request.body.payment
  const merchantId: string = request.body.merchantId
  const clientHmac: string = request.body.hmac
  // TODO: read secret from db for merchant
  const merchantSecret = SECRET

  log.info(`Found merchant for openPayment: ${merchantId}`)

  preparePayment(merchantId, merchantSecret, clientHmac, openPayment)
    .then(paymentSet => createLegacyOpenPayment(paymentSet.merchantId, paymentSet.merchantSecret, paymentSet.payment))
    .then(payment => v1SpecificValidations(payment))
    .then(payment => openPaymentWall(payment))
    .then(paymentWallXml => transformLegacyXmlToJson(paymentWallXml))
    .then(result => {
      response.json(result)
      log.info(`end openPayment for merchant ${merchantId}`)
    })
    .catch((error: ClientError) => {
      if (!error.http || !error.code) {
        log.error(`Unhandled error in openPayment: `, error)
        // TODO list this error into an alarm list that the developers will follow and fix as these emerge
        response.status(502).json(serverErrors.general)
      } else {
        log.error(`Error in openPayment: `, error)
        response.status(error.http).json(error)
      }
    })
}
