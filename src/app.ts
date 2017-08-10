
import * as swaggerMiddleware from 'swagger-express-mw'
import * as express from 'express'
import * as bunyan from 'bunyan'
import * as bodyParser from 'body-parser'
import * as swaggerUi from 'swagger-ui-express'
import * as path from 'path'
import * as YAML from 'yamljs'

import pong from './api/controllers/ping'

const swaggerYamlPath = path.join(__dirname, './api/swagger/swagger.yaml')
const swaggerApiSpecification = YAML.load(swaggerYamlPath)

const config = {
  appRoot: __dirname // required config
};

const port = process.env['PORT'] ? process.env['PORT'] : 3002
const log = bunyan.createLogger({ name: 'api' })
const app = express()
const IN_PRODUCTION = 'production'

process.on('uncaughtException', (error: any) => {
  if (log !== undefined) {
    // if we have logging capacity present when the app crahes, write error log
    log.error('Unhandled exception at: ', JSON.stringify(error))
  }

  // push it to std::out anyway, just in case
  console.log('Unhandled exception at: ', error)
  process.exit(-1)
})


app.use(bodyParser.json())
// - who tought this was a good idea? REALLY? If this is not disabled, we are opening additional attack windows by telling what we're running on top of
app.disable('x-powered-by')
// This will display the actual swagger gui for easier testing purposes
const apiUiDocumentPath  = '/api'
const mocksDirectoryPath = path.join(__dirname, './api/mocks/')

app.use(apiUiDocumentPath, swaggerUi.serve, swaggerUi.setup(swaggerApiSpecification))
// Allows us to serve static files for the mock files so the swagger.yaml can use them as example references from openapi yaml
app.use('/examples', express.static(mocksDirectoryPath))

swaggerMiddleware.create(config, (error: Error, swaggerExpress: { register: (application: express.Application) => void }) => {
  if (error) {
    throw error
  }

  // install middleware
  swaggerExpress.register(app)
  // Making sure root gets redirected to swagger, place the swagger middleware on root directly and it'll eat all uris
  app.get('/',  (_: express.Request, response: express.Response) => response.redirect(apiUiDocumentPath))

  // Ping api will not be listed in the public swagger documentation.
  // It will be available to everyone, but it's not listed as it's mainly used by monitoring services but if someone discovers it and starts using it, no harm done.
  // Secure from firewall/loadbalancer to only allow the monitoring services to get access to the url
  app.get('/ping', pong)

  if (process.env['NODE_ENV'] === IN_PRODUCTION) {
    // In production we respond with 404 on all calls that are not listed explicitly
    app.get('*', (_: express.Request, response: express.Response) => response.status(401).send())
  }

  app.listen(port, _ => {
    log.info(`API overlay listening on port ${port}!`)
    log.info(`Running in ${process.env['NODE_ENV'] === IN_PRODUCTION ? IN_PRODUCTION : 'development'} mode.`)
  })
})

// This is only used so we can actually require the whole express.js structure in test frameworks for testing purposes
module.exports = app
