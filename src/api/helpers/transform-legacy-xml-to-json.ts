import * as xml2js from 'xml2js'
import {
  OpenPayment,
  ClientError,
  PaymentWall,
  HtmlPaymentButtonForm,
  HtmlInput,
  HtmlInputHidden,
  HtmlInputImage
} from '../../types'
import { clientErrors, serverErrors } from './errors'
import * as util from 'util'
import * as bunyan from 'bunyan'
import * as R from 'ramda'

const log = bunyan.createLogger({ name: 'transformLegacyXmlToPaymentWall' })

/**
 * Transforms the legacy XML response into a proper PaymentWall object.
 *
 * @param {string} xml Full XML result sent by the legacy API.
 * @returns {Promise} Resolves into PaymentWall object and in case of error, rejects into ClientError object.
 */
const transformLegacyXmlToPaymentWall = (xml: string) => new Promise(
  (
    resolve: (result: PaymentWall) => void,
    reject: (error: ClientError) => void
  ) => {

  log.info('Starting to parse XML')
  // NOTE: we are not going to type the result object at this point as it's messy XML.
  // TODO update the node8.2.x series type definitions for Node.js or write them manually to get the util.promisify working on and promisify the calls to xml2js library
  xml2js.parseString(xml, (error: string, result: any) => xmlConverter(error, result, resolve, reject));
})

const xmlConverter = (error: string, result: any, resolve: (result: PaymentWall) => void, reject: (error: ClientError) => void) => {
  if (error) {
    let clientError = serverErrors.legacy.error
    clientError.rawError = error

    log.error('Error in parsing the v1 payment wall XML:', clientError.rawError)
    reject(clientError)
  } else {
    log.info('XML parsing complete')
    // parse all the properties from the XML with quite a bit of assumptions on the behavior
    const merchant = R.head(result.trade.merchant || [{}])
    // Due to the fact that the xml lib packs everything into arrays we'll have to perform a bit of trickery to REALLY get the payment
    // buttons out of hiding
    const payments = R.head(result.trade.payments || [])

    // We just abuse Ramda for now to strip the arrays into a simple objects.
    const wall: PaymentWall = {
      payment: collectPaymentInformationFromXml(result),
      merchant: collectMerchantInformationFromXml(merchant),
      buttons: collectButtonsFromXml(payments)
    }

    resolve(wall)
  }
}

const collectPaymentInformationFromXml = (result: any) => {
  return {
    id: R.head(result.trade.id || ['']),
    description: R.head(result.trade.description || ['']),
    status: R.head(result.trade.status || ['']),
    // TODO insert button.{amount,id,stamp} here? I think we already have the same stamp. Check legacy response and move if possible.
    stamp: R.head(result.trade.stamp || ['']),
    // TODO sort better default than just stupidly puking 0001
    version: R.head(result.trade.version || ['0001']),
    reference: R.head(result.trade.reference || ['']),
    language: R.head(result.trade.language || ['']),
    content: R.head(result.trade.content || ['']),
    deliveryDate: R.head(result.trade.deliveryDate || ['']),
    type: R.head(result.trade.type || ['0']),
    algorithm: R.head(result.trade.algorithm || ['']),
    paymentUrl: R.head(result.trade.paymentURL || ['']),
    customer: {
      firstName: R.head(result.trade.firstname || ['']),
      lastName: R.head(result.trade.lastname || ['']),
      email: R.head(result.trade.customerEmail || [''])
    },
    delivery: {
      streetAddress: R.head(result.trade.address || ['']),
      postalCode: R.head(result.trade.postcode || ['']),
      city: R.head(result.trade.postoffice || ['']),
      country: R.head(result.trade.country || [''])
    },
    redirect: {
      returnUrl: R.head(result.trade.returnURL || ['']),
      returnHmac: R.head(result.trade.returnMAC || ['']),
      cancelUrl:  R.head(result.trade.cancelURL || ['']),
      cancelHmac: R.head(result.trade.cancelMAC || ['']),
      rejectUrl: R.head(result.trade.rejectURL || ['']),
      // No rejectMAC present in XML?
      rejectMac: R.head(result.trade.rejectMAC || ['']),
      delayedUrl: R.head(result.trade.delayedURL || ['']),
      delayedMac: R.head(result.trade.delayedMAC || [''])
    }
  }
}

const collectMerchantInformationFromXml = (merchant: any) => {
  return {
    id: R.head(merchant.id || ['']),
    company: R.head(merchant.company || ['']),
    vatId: R.head(merchant.vatId || ['']),
    name: R.head(merchant.name || ['']),
    email: R.head(merchant.email || ['']),
    phone: R.head(merchant.helpdeskNumber || ['']),
  }
}

/**
 * Converts the bank buttons from the legacy XML into a sensible JSON payment wall PaymentButtons that we can handle.
 * NOTE: the effort to type 'payments' is not reasonable vs what it gives us. It's JSON full of arrays converted from XML.
 *
 * @param {any} payments JSONified XLM elemens from Checkout API
 * @returns {Array[PaymentButton]} Returns valid JSON object
 */
const collectButtonsFromXml = (payments: any) => {
  // Checkout calls all payment methods banks so we are going to use the same variable
  // naming and throw them out when we are done and name them in a more reasonable manner
  const banks = R.head(payments.payment || [])
  const amount = R.head(banks.amount)
  const stamp = R.head(banks.stamp)
  const id = R.head(banks.id)

  const buttons = R.head(banks.banks || [])
  const list: HtmlPaymentButtonForm[] = []

  // After we dug out the buttons, we have to manually convert them into a coherent format. So here we go, swoosh.

  // Iterate over the objects properties and transform them as needed
  const mappedButtons = Object.keys(buttons).map(provider => {
    let rawProviderButton = R.head(buttons[provider])

    let providerButtonForm: HtmlPaymentButtonForm = {
      htmlElement: 'form',
      name: rawProviderButton['$'].name,
      group: selectGroup(rawProviderButton['$'].name),
      properties: {
        method: 'post',
        action: rawProviderButton['$'].url
      },
      children: [
        // Fill up the tuple's first array with the hidden buttons once we iterate over the arbitary properties that change per button
        [],
        {
          htmlElement: 'span',
          children: [{
            type: 'image',
            src: rawProviderButton['$'].icon
          }]
        }
      ]
    }

    Object.keys(rawProviderButton).forEach(property => {
      // we go balls deep and always take 0 index, if the property is there then it has a size 1 array in it
      // -- xml2js feature causes this in this case - unless it's '$' -property..
      if (property !== '$') {
        // Push the new hidden input into the first element of the tuple that's the hidden input array for input properties
        providerButtonForm.children[0].push({
          type: 'hidden',
          name: property,
          value: rawProviderButton[property][0]
        })
      }
    })

    // we have created a single button with all of its content
    list.push(providerButtonForm)
  })

  return {
    amount,
    stamp,
    id,
    list
  }
}

const selectGroup = (providerName: string) => {
  const groups = {
    mobiles: [
      "mobilepay",
      "masterpass",
      "pivo"
    ],
    banks: [
      "saastopankki",
      "säästöpankki",
      "osuuspankki",
      "op",
      "nordea",
      "s-pankki",
      "spankki",
      "danske bank",
      "handelsbanken",
      "pop-Pankki",
      "poppankki",
      "aktia",
      "sp/omasp",
      "omasp",
      "sp",
      "ålandsbanken"
    ],
    cards: [
      "visa",
      "mastercard",
      "visa electron",
      "visaelectron"
    ],
    loaners: [
      "euroloan",
      "collector"
    ]
  }
  const name = providerName.toLowerCase()
  if (groups.mobiles.indexOf(name) !== -1) {
    return 'mobile'
  }

  if (groups.banks.indexOf(name) !== -1) {
    return 'bank'
  }

  if (groups.cards.indexOf(name) !== -1) {
    return 'card'
  }

  if (groups.loaners.indexOf(name)  !== -1) {
    return 'loaner'
  }

  return 'other'
}


export default transformLegacyXmlToPaymentWall
