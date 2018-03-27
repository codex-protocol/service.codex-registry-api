import Bluebird from 'bluebird'

import formatResponse from '../middleware/format-response'
import formatResponseError from '../middleware/format-response-error'
import throwRouteNotFoundError from '../middleware/throw-route-not-found-error'

export default (app) => {

  // must come before the response formatters below since the error thrown by
  //  this middleware needs to be formatted too
  app.use(throwRouteNotFoundError())

  // formatResponseError must come before formatResponse, since formatResponse
  //  uses the error object set by formatResponseError
  app.use(formatResponseError())
  app.use(formatResponse())

  // the initializer index expects promises to be return from all initializers
  //  so just return a resolved promise
  return Bluebird.resolve(app)

}
