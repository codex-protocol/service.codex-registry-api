import mongoose from 'mongoose'

// import config from '../config'
import mongooseService from '../services/mongoose'

const schemaOptions = {
  timestamps: true, // let mongoose handle the createdAt and updatedAt fields
  usePushEach: true, // see https://github.com/Automattic/mongoose/issues/5574
}

// NOTE: all of the hashes below are NOT calculated by the API and are the
//  hashes as they exist in the smart contract
const schema = new mongoose.Schema({
  // instead of using an auto-generated ObjectId, let's just use the tokenId
  //  stored in the smart contract since it's already a unique identifier for
  //  this Record (and also makes mapping DB records to smart contract records
  //  easier)
  _id: {
    type: String,
    required: true,
    alias: 'tokenId',
  },
  ownerAddress: {
    index: true,
    type: String,
    required: true,
    lowercase: true,
    // TODO: add validators to make sure only proper addresses can be specified
  },
  approvedAddress: {
    type: String,
    sparse: true,
    default: null,
    lowercase: true,
    // TODO: add validators to make sure only proper addresses can be specified
  },
  nameHash: {
    type: String,
    required: true,
    lowercase: true,
  },
  descriptionHash: {
    type: String,
    default: null,
    lowercase: true,
  },
  fileHashes: [{
    type: String,
  }],
  providerId: {
    type: String, // TODO: use mongoose.Schema.Types.ObjectId?
    default: null,
    // ref: 'Provider', // TODO: link this to a Provider model?
  },
  providerMetadataId: {
    type: String,
    default: null,
  },
  isPrivate: {
    type: Boolean,
    default: true,
  },
  // has this Record been ignored by the approvedAddress? this essentially just
  //  hides it from the frontend "incoming transfer" view and has no real
  //  correlation to anything in the smart contract
  isIgnored: {
    type: Boolean,
    default: false,
  },
  // this is a list of addresses explicitly allowed to view this Record even if
  //  it's private
  //
  // NOTE: this will not include the ownerAddress and approvedAddress addresses
  //  since those are implied as whitelisted
  whitelistedAddresses: {
    type: [{
      type: String,
      lowercase: true,
      // TODO: add validators to make sure only proper addresses can be specified
    }],
  },
  metadata: {
    default: null,
    ref: 'CodexRecordMetadata',
    type: mongoose.Schema.Types.ObjectId,
  },
  provenance: [{
    ref: 'CodexRecordProvenanceEvent',
    type: mongoose.Schema.Types.ObjectId,
  }],
}, schemaOptions)

// TODO: maybe insted this should be migrated to the toJSON transform? that
//  would just require all routes to pass the userAddress in the options
//  though... e.g.:
//
// return codexRecord.toJSON({ userAddress: response.locals.userAddress })
//
// this has the potential to cause problems if a save() operation is called
//  after maskOwnerOnlyFields()... hmm...
schema.methods.maskOwnerOnlyFields = function maskOwnerOnlyFields(userAddress) {

  if (userAddress === this.ownerAddress) {
    return false
  }

  this.whitelistedAddresses = []

  if (this.populated('metadata')) {
    this.metadata.depopulate('pendingUpdates')
    this.metadata.depopulate('images')
    this.metadata.depopulate('files')
  }

  return true

}

schema.methods.applyPrivacyFilters = function applyPrivacyFilters(userAddress) {

  // if this isn't a private Record, apply no filters
  if (!this.isPrivate) {
    return this.maskOwnerOnlyFields(userAddress)
  }

  const whitelistedAddresses = [
    this.ownerAddress,
    this.approvedAddress,
    ...this.whitelistedAddresses,
  ]

  // if the user is logged in and a whitelisted address, apply no filters
  //
  // NOTE: userAddress could be null, and this.approvedAddress could be null,
  //  so we must explicity check if userAddress is null first to avoid false
  //  positives
  if (userAddress && whitelistedAddresses.includes(userAddress)) {
    return this.maskOwnerOnlyFields(userAddress)
  }

  this.depopulate('metadata')

  this.maskOwnerOnlyFields(userAddress)

  return true

}

schema.set('toJSON', {
  getters: true, // essentially converts _id to just id
  virtuals: true,
  versionKey: false,
  transform(document, transformedDocument) {

    // remove some mongo-specific keys that aren't necessary to send in
    //  responses
    delete transformedDocument._id
    delete transformedDocument.id

    // remove any populations if they weren't populated, since they'll just be
    //  ObjectIds otherwise and that might expose too much information to
    //  someone who isn't allowed to view that data
    //
    // NOTE: instead of deleting keys, we'll just pretend they're empty, that
    //  way the front end can always assume the keys will be present
    if (document.provenance && document.provenance.length > 0 && !document.populated('provenance')) {
      // delete transformedDocument.provenance
      transformedDocument.provenance = []
    }

    if (document.metadata && !document.populated('metadata')) {
      // delete transformedDocument.metadata
      transformedDocument.metadata = null
    }

    return transformedDocument

  },
})

schema.set('toObject', {
  virtuals: true,
})

// make all queries for addresses lowercase, since that's how we store them
function makeQueryAddressesCaseInsensitive(next) {
  const query = this.getQuery()
  if (typeof query.ownerAddress === 'string') query.ownerAddress = query.ownerAddress.toLowerCase()
  if (typeof query.approvedAddress === 'string') query.approvedAddress = query.approvedAddress.toLowerCase()
  next()
}

schema.pre('find', makeQueryAddressesCaseInsensitive)
schema.pre('count', makeQueryAddressesCaseInsensitive)
schema.pre('update', makeQueryAddressesCaseInsensitive)
schema.pre('findOne', makeQueryAddressesCaseInsensitive)
schema.pre('findOneAndRemove', makeQueryAddressesCaseInsensitive)
schema.pre('findOneAndUpdate', makeQueryAddressesCaseInsensitive)

export default mongooseService.codexRegistry.model('CodexRecord', schema)