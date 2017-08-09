
import { Poll, ClientError, PaymentWall } from '../../../types'
import { clientErrors, serverErrors } from '../../helpers/errors'
import transformLegacyXmlToJson from '../../helpers/transform-legacy-xml-to-json'
import isHmacValid from '../../helpers/hmac-validator'
import toValueString from '../../helpers/value-stringifier'

import * as express from 'express'
import * as crypto from 'crypto'
import * as unirest from 'unirest'
import * as R from 'ramda'
import * as bunyan from 'bunyan'
import * as xml2js from 'xml2js'

const log = bunyan.createLogger({ name: 'v1-poll' })

/**
 * Format Checkouts API requires and otherwise the application does not care for.
 */
interface LegacyPoll {
  VERSION: '0001'|'0002'
  STAMP: string
  REFERENCE: string
  MERCHANT: string
  AMOUNT: number
  CURRENCY: string
  FORMAT: 1
  ALGORITHM: 1
  MAC: string
}

interface PollSet {
  merchantId: string
  merchantSecret: string
  clientHmac: string
  poll: Poll
}

// TODO remove completely once we are done with tests, this is not required at all.
const SECRET = 'SAIPPUAKAUPPIAS'
// Constant values for single payment that will never change for the legacy API
const SINGLE_REFUND_VERSION = '0001'
const FORMAT = 1
const ALGORITHM = 1

const preparePoll = (merchantId: string, merchantSecret: string, clientHmac: string, poll: Poll) => new Promise((
    resolve: (pollSet: PollSet) => void,
    reject: (errro: ClientError) => void
  ) => {

  if (!isHmacValid<Poll>(clientHmac, merchantSecret, poll)) {
    // TODO start using same validation for all APIs that take in the property validators after the hmac as parameters
    log.warn(`Hmac validation for ${merchantId} failed in poll. Incorrect hmac was: ${clientHmac}.`)
    reject(clientErrors.hmac)
    return
  }

  resolve({
    merchantId,
    merchantSecret,
    clientHmac,
    poll
  })
})


const createLegacyPoll = (merchantId: string, merchantSecret: string, poll: Poll) => new Promise((
    resolve: (response: any) => void,
    reject: (Error: any) => void
  ) => {

  const legacyPoll: LegacyPoll = {
    VERSION: SINGLE_REFUND_VERSION,
    STAMP: poll.stamp,
    REFERENCE: poll.reference,
    MERCHANT: merchantId,
    AMOUNT: poll.amount,
    CURRENCY: poll.currency,
    FORMAT,
    ALGORITHM,
    MAC: ''
  }

  /**
   * Temporary interface we use to make sure we match a type as defined
   */
  interface TemporaryPollReducer extends LegacyPoll {
    merchantSecret: string
  }

  const values = toValueString<TemporaryPollReducer>(
    { ...legacyPoll, merchantSecret },
    [ 'VERSION', 'STAMP', 'REFERENCE', 'MERCHANT', 'AMOUNT', 'CURRENCY', 'FORMAT', 'ALGORITHM', 'merchantSecret' ],
    '+'
  )

  // the old poll layer wall uses md5... what the hell. This is unbelievable. Not much we can do about that here.
  legacyPoll.MAC = crypto.createHash('md5')
    .update(values)
    .digest('hex')
    .toUpperCase()

  console.log(Object.keys(legacyPoll).map(key => `${key}=${legacyPoll[key]}`))
  console.log(values)
  console.log()

  unirest
    .post('https://rpcapi.checkout.fi/poll')
    .headers({})
    .send(legacyPoll)
    .end((result: any) => {
      log.info(`Poll replied.. parsing reply`)
      // First make sure we have handled the http error codes
        console.log('result from xml', result.statusCode)
        console.log('result from xml', result.body)
        resolve(result.body)
    })
})

/**
 *
 *
 * @param {express.Request} request Express request
 * @param {express.Response} response Express response
 */
export const pollPayment = (request: express.Request, response: express.Response) => {
  log.info(`Start poll.. finding merchant`)

  const poll: Poll = request.body.poll
  const merchantId: string = request.body.merchantId
  const clientHmac: string = request.body.hmac
  // TODO: read secret from db for merchant
  const merchantSecret = SECRET

  log.info(`Found merchant for poll: ${merchantId}`)

  preparePoll(merchantId, merchantSecret, clientHmac, poll)
    .then(paymentSet => createLegacyPoll(paymentSet.merchantId, paymentSet.merchantSecret, paymentSet.poll))
    .then(result => {
      response.json(result)
      log.info(`End poll for merchant ${merchantId}`)
    })
    .catch((error: ClientError) => {
      if (!error.http || !error.code) {
        log.error(`Unhandled error in poll: `, error)
        // TODO list this error into an alarm list that the developers will follow and fix as these emerge
        response.status(502).json(serverErrors.general)
      } else {
        log.error(`Error in poll: `, error)
        response.status(error.http).json(error)
      }
    })
}
