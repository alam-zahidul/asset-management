import Joi from 'joi';
import { getActiveFields, FieldDefinition } from './fieldService';
import { ValidationError } from '../utils/errors';

export async function validateAssetData(
  fieldValues: Record<string, unknown>,
  isPartial = false
): Promise<Record<string, unknown>> {
  const fields = await getActiveFields();
  const errors: Record<string, string[]> = {};
  const validated: Record<string, unknown> = {};

  for (const field of fields) {
    const value = fieldValues[field.field_key];

    // Check required
    if (field.is_required && !isPartial && (value === undefined || value === null || value === '')) {
      errors[field.field_key] = [`${field.display_name} is required`];
      continue;
    }

    if (value === undefined || value === null || value === '') {
      if (field.default_value !== null && field.default_value !== undefined) {
        validated[field.field_key] = field.default_value;
      }
      continue;
    }

    const fieldErrors = validateFieldValue(field, value);
    if (fieldErrors.length > 0) {
      errors[field.field_key] = fieldErrors;
    } else {
      validated[field.field_key] = value;
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Validation failed', errors);
  }

  return validated;
}

function validateFieldValue(field: FieldDefinition, value: unknown): string[] {
  const errors: string[] = [];
  const rules = field.validation_rules || {};

  switch (field.field_type) {
    case 'text':
    case 'textarea': {
      if (typeof value !== 'string') {
        errors.push(`${field.display_name} must be text`);
        break;
      }
      if (rules.min && (value as string).length < (rules.min as number)) {
        errors.push(`${field.display_name} must be at least ${rules.min} characters`);
      }
      if (rules.max && (value as string).length > (rules.max as number)) {
        errors.push(`${field.display_name} must be at most ${rules.max} characters`);
      }
      if (rules.pattern) {
        const re = new RegExp(rules.pattern as string);
        if (!re.test(value as string)) {
          errors.push(`${field.display_name} format is invalid`);
        }
      }
      break;
    }
    case 'number': {
      const num = Number(value);
      if (isNaN(num)) {
        errors.push(`${field.display_name} must be a number`);
        break;
      }
      if (rules.min !== undefined && num < (rules.min as number)) {
        errors.push(`${field.display_name} must be at least ${rules.min}`);
      }
      if (rules.max !== undefined && num > (rules.max as number)) {
        errors.push(`${field.display_name} must be at most ${rules.max}`);
      }
      break;
    }
    case 'date': {
      const { error } = Joi.date().iso().validate(value);
      if (error) errors.push(`${field.display_name} must be a valid date`);
      break;
    }
    case 'boolean': {
      if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
        errors.push(`${field.display_name} must be true or false`);
      }
      break;
    }
    case 'email': {
      const { error } = Joi.string().email().validate(value);
      if (error) errors.push(`${field.display_name} must be a valid email`);
      break;
    }
    case 'url': {
      const { error } = Joi.string().uri().validate(value);
      if (error) errors.push(`${field.display_name} must be a valid URL`);
      break;
    }
    case 'ip_address': {
      const { error } = Joi.string().ip().validate(value);
      if (error) errors.push(`${field.display_name} must be a valid IP address`);
      break;
    }
    case 'select': {
      if (field.select_options) {
        const options = typeof field.select_options === 'string'
          ? JSON.parse(field.select_options)
          : field.select_options;
        if (!options.includes(value)) {
          errors.push(`${field.display_name} must be one of: ${options.join(', ')}`);
        }
      }
      break;
    }
  }

  return errors;
}
