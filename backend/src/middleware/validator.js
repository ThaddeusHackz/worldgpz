import { validationResult } from 'express-validator';
import { ValidationError } from './errorHandler.js';

// Validate request
export const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));
    
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }
    
    const extractedErrors = errors.array().map(err => ({
      field: err.path,
      message: err.msg,
    }));
    
    next(new ValidationError('Validation failed', extractedErrors));
  };
};

// Query validation helper
export const validateQuery = (req, res, next) => {
  const { page, limit, sort, order } = req.query;
  
  // Validate pagination
  if (page && (isNaN(page) || parseInt(page) < 1)) {
    return next(new ValidationError('Invalid page number'));
  }
  
  if (limit && (isNaN(limit) || parseInt(limit) < 1 || parseInt(limit) > 100)) {
    return next(new ValidationError('Invalid limit (must be 1-100)'));
  }
  
  // Validate sort field
  const allowedSortFields = ['createdAt', 'updatedAt', 'title', 'severity', 'status'];
  if (sort && !allowedSortFields.includes(sort)) {
    return next(new ValidationError(`Invalid sort field. Allowed: ${allowedSortFields.join(', ')}`));
  }
  
  // Validate order
  if (order && !['asc', 'desc'].includes(order.toLowerCase())) {
    return next(new ValidationError('Invalid order (must be asc or desc)'));
  }
  
  next();
};

// Body validation helper
export const validateBody = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      return next(new ValidationError(error.details[0].message));
    }
    
    next();
  };
};

export default {
  validate,
  validateQuery,
  validateBody,
};