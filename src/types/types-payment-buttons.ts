
// TODO after few test runs with the json schema, start using this https://mozilla-services.github.io/react-jsonschema-form/ - separate into Uischema and data schema

// TODO this type heavily depends on the XML format and validation we are performing, make sure it's typed as strictly as possible as we learn more of the XML
export interface PaymentWall {
  // TODO after first round of figuring out the XML to JSON, type PaymentWall.payment and try to match it with the existing OpenPayment format or extract shared type from it that both can then use - the probable case
  payment: any
  // TODO after first round of figuring out the XML to JSON, type PaymentWall.merchant and try to match it with the existing Merchant format or extract shared type from it that both can then use - the probable case
  merchant: any
  buttons: {
    stamp: string
    id: string
    amount: string

    /**
     * Actual list of UI elements to render with their content and details
     */
    list: Array<HtmlPaymentButtonForm>
  }
}

/**
 * Generalized structure for a single render capable payment button.
 * Should generate HTML that roughly could look like this:
 *
 *   <form action="https://test.secret-bank.fi/something/api/something" method="post">
 *     <input type="hidden" name="total" value="20">
 *     <input type="hidden" name="reference" value="123">
 *     <input type="hidden" name="something" value="123">
 *     <input type="hidden" name="currency" value="EUR">
 *     <input type="hidden" name="version" value="4">
 *     <input type="hidden" name="confirmurl" value="https://payment.checkout.fi/fYBZzU28ov/fi/confirm?ORDER=123&amp;ORDERMAC=123">
 *     <input type="hidden" name="errorurl" value="https://payment.checkout.fi/fYBZzU28ov/fi/cancel">
 *     <input type="hidden" name="hash" value="test-123-test">
 *     <input type="hidden" name="duedate" value="12.12.2017">
 *     <input type="hidden" name="algorithm" value="03">
 *     <input type="hidden" name="language" value="1">
 *     <span>
 *       <input type="image" src="https://payment.checkout.fi//static/img/danskebank_140x75.png"></span>
 *     <div>Danske Bank</div>
 *   </form>
 *
 * Obviously you are free to render the buttons how ever you like, this is just an example of what it could be like and to help you understand
 * the structure of the JSON
 */
export interface HtmlPaymentButtonForm {
  // Render me as a form
  htmlElement: 'form'
  name: string
  group: 'mobile'|'card'|'loaner'|'bank'|'other'

  /**
   * Properties of this form
   */
  properties: {
    action: string
    method: 'post'
  }

  /**
   * Hidden inputs that will carry the form data over with the POST call to the third party (bank, loaner, etc),
   * the second element of the typle, span is the visual representation of the button
   */
  children: [Array<HtmlInputHidden>, HtmlSpanButton]
}

export interface HtmlSpanButton {
  // render me as a span
  htmlElement: 'span'

  children: Array<HtmlInputImage>
}

export interface HtmlInput {
  type: 'hidden'|'image'
}

export interface HtmlInputImage extends HtmlInput {
  src: string
}

export interface HtmlInputHidden extends HtmlInput {
  name: string
  value: any
}
