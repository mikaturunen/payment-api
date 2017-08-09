import * as bunyan from 'bunyan'
import * as crypto from 'crypto'

import { OpenPayment, PaymentSet, ClientError } from '../../types'
import { clientErrors, serverErrors } from './errors'
import { validateProperties } from './property-validators'
import isHmacValid from './hmac-validator'

const log = bunyan.createLogger({ name: 'api-payment-preparation' })

/**
 * Is the given client hmac same as the server side computed hmac
 *
 * @param {string} merchantId Merchant id, also knows as mid.
 * @param {string} merchantSecret Merchants shared secret
 * @param {string} clientHmac Client calculated HMAC.
 * @param {OpenPayment} payment Payment object that is for validation
 * @returns {Promise} Resolves following objcet { merchantId, merchantSecret, clientHmac, payment } when the OpenPayment is valid. Otherise rejects with exact error codes that are client compatible.
 */
export const preparePayment = (merchantId: string, merchantSecret: string, clientHmac: string, payment: OpenPayment) => {
  // TODO once the idea is tested, remove any types
  return new Promise((resolve: (payment: PaymentSet) => void, reject: any) => {
    // 1. validate hmac
    log.info(`Checking payment hmac (mid: ${merchantId}, ref: ${payment.reference}, stamp: ${payment.stamp}, amount: ${payment.totalAmount})`)

    if (!isHmacValid<OpenPayment>(clientHmac, merchantSecret, payment)) {
      log.warn(`Hmac validation for ${merchantId} failed. Incorrect hmac was: ${clientHmac}.`)
      reject(clientErrors.hmac)
      return
    }

    log.info(`Payment hmac OK (mid: ${merchantId}, ref: ${payment.reference}, stamp: ${payment.stamp}, amount: ${payment.totalAmount})`)

    // 2. validate properties -- first check are we missing any properties
    // TODO I think swaggers definitions already take care of this and we do not have to worry over this anymore - remove

    log.info(`Checking payment property validation (mid: ${merchantId}, ref: ${payment.reference}, stamp: ${payment.stamp}, amount: ${payment.totalAmount})`)

    const paymentInfo = validateProperties(payment)
  /*
    if (paymentInfo.missingProperties.length > 0) {
      log.warn(`Body validation for ${merchantId} failed. Missing the following properties from payment: ${paymentInfo.missingProperties}`)
      let error: ClientError = clientErrors.missingPaymentProperties
      error.rawError = {
        missingProperties: paymentInfo.missingProperties
      }
      reject(error)
      return
    }
*/

    // 2. validate properties -- check are the properties valid
    if (paymentInfo.invalidProperties.length > 0) {
      log.warn(`Body validation for ${merchantId} failed. The following properties from payment are invalid: ${paymentInfo.invalidProperties}`)
      let error: ClientError = clientErrors.invalidPaymentProperties
      error.rawError = {
        inavaliProperties: paymentInfo.invalidProperties
      }
      reject(error)
      return
    }

    log.info(`Checking payment property validation OK (mid: ${merchantId}, ref: ${payment.reference}, stamp: ${payment.stamp}, amount: ${payment.totalAmount})`)

    resolve({
      merchantId,
      merchantSecret,
      clientHmac,
      payment
    })
  })
}
