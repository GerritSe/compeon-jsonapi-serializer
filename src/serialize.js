import {
  includes,
  isEmpty,
  isPlainObject,
  pick,
  reduce
} from 'lodash'

import { extractIdentifier, renderIdentifier } from './common'
import { mergeArrays, partition } from './utils'

const removeDuplicateIncludes = included => {
  const includeDictionary = {}

  return reduce(included, (result, include) => {
    const { name, value } = extractIdentifier(include)
    const path = [include.type, name, value].join('/')

    if (!includeDictionary[path]) {
      result.push(include)
      includeDictionary[path] = true
    }

    return result
  }, [])
}

const extractResourceInformation = (resource, attributeNames, relationshipNames) => {
  const identifier = extractIdentifier(resource)
  const permittedAttributes = pick(resource, attributeNames)
  const [relationships, attributes] = partition(permittedAttributes, (_, key) => (
    includes(relationshipNames, key)
  ))

  return {
    attributes,
    identifier,
    relationships
  }
}

const renderResourceAttribute = (key, attribute) => {
  if (isEmpty(attribute)) return null
  return { [key]: attribute }
}

const renderResource = (type, identifier = {}, attributes, relationships, included) => ({
  data: {
    ...renderIdentifier(identifier),
    ...renderResourceAttribute('attributes', attributes),
    ...renderResourceAttribute('relationships', relationships),
    type
  },
  ...renderResourceAttribute('included', included)
})

const serializeRelationships = (relationships, options) => (
  reduce(relationships, (result, value, key) => {
    const relationshipOptions = options[key]

    if (!isPlainObject(relationshipOptions)) return result
    if (!relationshipOptions.type) throw `You did not specify a type for the relationship '${key}'`

    const { data, included } = Array.isArray(value)
      ? serializeResources(relationshipOptions.type, value, relationshipOptions)
      : serializeResource(relationshipOptions.type, value, relationshipOptions)

    if (!isEmpty(data)) result.relationships[key] = { data }
    if (!isEmpty(included)) result.included = mergeArrays(result.included, included)

    return result
  }, { relationships: {}, included: [] })
)

const serializeResource = (type, resource, options, root = false) => {
  const attributeOptions = options.attributes || []
  const relationshipOptions = options.relationships || {}
  const relationshipNames = Object.keys(relationshipOptions)
  const {
    attributes,
    identifier,
    relationships
  } = extractResourceInformation(resource, attributeOptions, relationshipNames)
  const {
    included,
    relationships: serializedRelationships
  } = serializeRelationships(relationships, relationshipOptions)

  if (root) {
    return renderResource(
      type,
      identifier,
      attributes,
      serializedRelationships,
      removeDuplicateIncludes(included)
    )
  }
  if (!identifier.valid) return {}
  if (!isEmpty(attributes)) {
    const resource = renderResource(type, identifier, attributes, serializedRelationships)
    included.push(resource.data)
  }

  return renderResource(type, identifier, null, null, included)
}

const serializeResources = (type, resources, options, root = false) => {
  const { included, ...result } = reduce(resources, (result, value, key) => {
    const { data, included } = serializeResource(type, value, options, root)

    if (data) result.data.push(data)
    if (!isEmpty(included)) result.included = mergeArrays(result.included, included)

    return result
  }, { data: [] })

  if (!included) return result

  return {
    ...result,
    included: removeDuplicateIncludes(included)
  }
}

export const serialize = (type, options = {}) => {
  if (!type) throw 'You did not specify a type for the root resource.'

  return subject => {
    if (isPlainObject(subject)) return serializeResource(type, subject, options, true)
    if (Array.isArray(subject)) return serializeResources(type, subject, options, true)
    return renderResource(type)
  }
}
