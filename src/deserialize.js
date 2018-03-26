import {
  find,
  get,
  isEmpty,
  isPlainObject,
  map,
  reduce
} from 'lodash'

import { extractIdentifier, renderIdentifier } from './common'

const findInclude = (type, identifier, included) => (
  find(included, {
    ...renderIdentifier(identifier),
    type
  })
)

const deserializeRelationships = (relationships, included) => (
  reduce(relationships, (result, value, key) => {
    const data = get(value, 'data')
    let deserializedResource

    if (Array.isArray(data)) {
      deserializedResource = deserializeResources(data, included)
    } else if (isPlainObject(data)) {
      deserializedResource = deserializeResource(data, included)
    }

    if (!isEmpty(deserializedResource)) result[key] = deserializedResource

    return result
  }, {})
)

const deserializeResource = (resource, included, root = false) => {
  const identifier = extractIdentifier(resource)
  const { attributes, relationships, type } = resource
  const {
    attributes: includedAttributes,
    relationships: includedRelationships
  } = findInclude(type, identifier, included) || {}
  const renderedAttributes = root ? attributes : includedAttributes

  // Resources without a valid identifier are not specified.
  // TODO: Actually, an empty object should be rendered even for the root
  // object. This is not possible yet due to some endpoints that do not return
  // an identifier (e.g. email and company-suggestions).
  if (!root && !identifier.valid) return {}

  return {
    ...renderIdentifier(identifier),
    ...renderedAttributes,
    ...deserializeRelationships(relationships, included),
    ...deserializeRelationships(includedRelationships, included)
  }
}

const deserializeResources = (resources, included, root = false) => (
  map(resources, resource => deserializeResource(resource, included, root))
)

export const deserialize = (options = {}) => subject => {
  const { data, included } = subject

  if (Array.isArray(data)) {
    return deserializeResources(data, included, true)
  } else if (isPlainObject(data)) {
    return deserializeResource(data, included, true)
  }

  return {}
}
