import RestifyErrors from 'restify-errors'
import { contracts } from '@codex-protocol/ethereum-service'

import config from '../../../config'
import models from '../../../models'

export default {

  method: 'get',
  path: '/users?/faucet',

  requireAuthentication: true,

  restrictToEnvironments: [
    config.faucet.enabled ? process.env.NODE_ENV : '',
  ],

  handler(request, response) {

    const now = Date.now()

    return models.User.findById(response.locals.userAddress)
      .then((user) => {

        if (user.faucetLastRequestedAt && now - user.faucetLastRequestedAt.getTime() < config.faucet.cooldown) {
          return user.save()
            .then(() => {
              throw new RestifyErrors.ForbiddenError(
                'You are not allowed to request tokens from the faucet right now. Please try again later.'
              )
            })
        }

        user.faucetLastRequestedAt = now

        return user

      })
      .then((user) => {

        return contracts.CodexCoin.methods.paused().call()
          .then((isPaused) => {

            if (isPaused) {
              throw new RestifyErrors.ConflictError(
                'Token distribution is currently paused. Please try again later.'
              )
            }

            return user

          })

      })
      .then((user) => {

        const transferArguments = [
          user.address,
          config.faucet.amount,
        ]

        const newTransactionData = {
          type: 'faucet-transfer',
          status: 'created',
          tx: {
            value: 0,
            gasPrice: config.blockchain.gasPrice,
            gasLimit: config.blockchain.gasLimit,
            to: contracts.CodexCoin.options.address,
            from: config.blockchain.signerPublicAddress,
            data: contracts.CodexCoin.methods.transfer(...transferArguments).encodeABI(),
          },
        }

        return new models.Transaction(newTransactionData).save()
          .then(() => {
            return user.save()
          })

      })
      .then((user) => {
        return null
      })
  },

}
