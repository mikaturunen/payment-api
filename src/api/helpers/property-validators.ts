import { OpenPayment, PaymentItem, MerchantCustomer } from '../../types'
import * as R from 'ramda'


// TODO use proper validations and make it a middleware
// TODO implement better validators instead of these super simple ones
const minimumAmountIsZero = 0
const minimumStringLength = 2
const maxReferenceLength = 100

const isValidAmount = (payment: OpenPayment, key: string) => {
  let isValid = payment[key] > minimumAmountIsZero && payment.items.length > 0

  if (isValid) {
    const total = R.sum(
      R.pluck('amount')(payment.items)
    )

    // Making sure the marked total for the basket is the same as the total from the item.
    // We allow some items to be; for example, 0 - like shipping. But the total sum cannot be 0.
    isValid = payment[key] === total
  }

  return isValid
}

const isValidCurrency = (payment: OpenPayment, key: string) => payment[key].length >= minimumStringLength

const isValidReference = (payment: OpenPayment, key: string) => payment[key].length >= minimumStringLength && payment[key].length < maxReferenceLength

const isValidStamp = (payment: OpenPayment, key: string) => payment[key] >= 1

const isValidItems = (payment: OpenPayment, key: string) => {
  if (payment[key].length > 0) {
    const allItemsValid = true
    // TODO check individual items and their properties
    return allItemsValid
  } else {
    return false
  }
}

const allowedContentTypes = [0,1]
const isValidContent = (payment: OpenPayment, key: string) => allowedContentTypes.indexOf(payment[key]) !== -1

const isValidCountry = (payment: OpenPayment, key: string) => payment[key].length >= minimumStringLength

const isValidLanguage = (payment: OpenPayment, key: string) => payment[key].length >= minimumStringLength

const isValidMessage = (payment: OpenPayment, key: string) => payment[key].length < maxReferenceLength

const isValidCustomer = (payment: OpenPayment, key: string) => {
  const validEmail = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/

  const customer: MerchantCustomer = payment[key]
  return customer.firstName.length >= 2 && customer.firstName.length < 30 &&
    customer.lastName.length >= 2 && customer.lastName.length < 30 &&
    validEmail.test(customer.email)
}

const isValidMock = (payment: OpenPayment, key: string) => { return true }

// super simple checker that all properties are present
const properties = [
  { key: 'totalAmount', validator: isValidAmount },
  { key: 'currency', validator: isValidCurrency },
  { key: 'reference', validator: isValidReference },
  { key: 'stamp', validator: isValidMock },
  { key: 'items', validator: isValidItems },
  { key: 'content', validator: isValidContent },
  { key: 'country', validator: isValidCountry },
  { key: 'language', validator: isValidLanguage },
  { key: 'message', validator: isValidMessage },
  { key: 'customer', validator: isValidCustomer },
  { key: 'redirect', validator: isValidMock },
  { key: 'delivery', validator: isValidMock }
]

/**
 * Simple property validator.
 * TODO turn this into a middleware for express and make the validators better.
 *
 * @param {OpenPayment} payment Payment object.
 * @returns {Object} Returns object with missingProperties and invalidProperties and properties.
 */
export const validateProperties = (payment: OpenPayment) => {

  // collect all the properties that
  const missingProperties: string[] = []
  const invalidProperties: string[] = []

  properties.forEach(set => {
    if (!payment.hasOwnProperty(set.key)) {
      // property is missing
      missingProperties.push(set.key)
    } else if (!set.validator(payment, set.key)) {
      // property was not valid
      invalidProperties.push(set.key)
    }
  })

  return { missingProperties, invalidProperties }
}
