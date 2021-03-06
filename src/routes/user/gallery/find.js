import models from '../../../models'

export default {

  method: 'get',
  path: '/users?/galler(y|ies)',

  requireAuthentication: true,

  // @TODO: allow this in all environments when user galleries are implemented
  restrictToEnvironments: [
    'development',
  ],

  handler(request, response) {

    const conditions = {
      ownerAddress: response.locals.userAddress,
    }

    return models.Gallery.find(conditions)

  },

}
