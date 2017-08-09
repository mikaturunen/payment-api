import * as express from 'express'

/**
 * Simply pong response for pinging the service. Can be used by service monitors to see that the service is still actually alive.
 * @param {Request} request Express request object
 * @param {Response} response Express response object
 */
const pong = (request: express.Request, response: express.Response) => {
  response.json({
    message: 'pong',
    time: new Date().getTime()
  })
}

export default pong
