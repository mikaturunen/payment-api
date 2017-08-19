import * as crypto from 'crypto'

const hash = 'sha256'
const encoding = 'base64'

/**
 * Validates the client calculated hmac.
 *
 * @param {string} clientHmac Hmac sent to us by the client.
 * @param {string} merchantSecret The shared secret merchant used to calculate the actual hmac.
 * @param {T} payload Content that was encrypted with the shared secret.
 * @param {string} hashingMethod Defaults to 'sha256'. Can be anything supported by node crypto except md5.
 * @returns {boolean} True when the client calculated hmac is the same as the server side calculated.
 */
const isHmacValid = <T>(
    clientHmac: string,
    merchantSecret: string,
    payload: T,
    hashingMethod: string = hash
  ) => calculateHmac<T>(
    merchantSecret,
    payload,
    hashingMethod
  ) === clientHmac

/**
 * Calculates the HMAC for given payload.
 *
 * @param {string} merchantSecret The shared secret merchant used to calculate the actual hmac.
 * @param {T} payload Content that was encrypted with the shared secret.
 * @param {string} hashingMethod Defaults to 'sha256'. Can be anything supported by node crypto except md5.
 * @returns {boolean} True when the client calculated hmac is the same as the server side calculated.
 */
const calculateHmac = <T>(
    merchantSecret: string,
    payload: T,
    hashingMethod: string = hash
  ) => crypto
    .createHmac(hashingMethod, merchantSecret)
    .update(new Buffer(JSON.stringify(payload)).toString(encoding))
    .digest('hex')
    .toUpperCase()

export {
  isHmacValid,
  calculateHmac
}
