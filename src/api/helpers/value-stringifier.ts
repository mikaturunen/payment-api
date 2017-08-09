
/**
 * Converts object into a strintified series of values concatenated together with '+' -character. This value
 * string is used to calculate checkouts legacy apis hash.
 *
 * @param {T} object Object to convert into value string series for legacy hmac calculation.
 * @param {Array<string>} propertyOrder List of properties in correct order to read from the T.
 * @returns {string} Single string containing the values from 'object' concantenated into one with the 'combiner'
 */
const toValueString = <T>(object: T, propertyOrder: Array<string>, combiner: string) => propertyOrder
  .map(property => object[property])
  .join(combiner)

export default toValueString
