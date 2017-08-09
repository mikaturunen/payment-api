import { ClientError } from '../../types'

// using some constants to get some standard groove into the api
const paymentId = '1'
const v1 = '1'
const v2 = '2'

export const clientErrors = {
  legacy: {
    amount: <ClientError>{
      http: 400,
      code: `${v1}${paymentId}001`,
      message: 'Amount if not allowed to be 0 or less.'
    },
    overlay: <ClientError>{
      http: 400,
      code: `${v1}${paymentId}100`,
      message: 'General error from v1 that has not been configured into overlay yet. Check rawError for details.'
    }
  },
  hmac: <ClientError>{
    http: 400,
    code: `${v2}${paymentId}001`,
    message: 'Incorrectly calculated HMAC.'
  },
  missingPaymentProperties: <ClientError>{
    http: 400,
    code: `${v2}${paymentId}002`,
    message: 'Missing properties from payment body.'
  },
  invalidPaymentProperties: <ClientError>{
    http: 400,
    code: `${v2}${paymentId}003`,
    message: 'Invalid body parameters, failed property validation.'
  }
}

// These serverErrors are errors that were caused by something on the server and not directly due to client input
export const serverErrors = {
  legacy: {
    error: <ClientError>{
      http: 502,
      code: ``,
      message: 'Error in v1, check rawError for details.'
    }
  },
  // TODO make this better
  general: <ClientError>{
    http: 502,
    code: `xxxx`,
    message: 'We have no idea what went wrong, we are truly sorry for this, please get in touch with our developers at `...`.'
  }
}
