import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { BadRequestError } from '../utils/errors';

type ValidationTarget = 'body' | 'query' | 'params';

export function validate(schema: Joi.ObjectSchema, target: ValidationTarget = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[target], {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      const messages = error.details.map((d) => d.message).join('; ');
      throw new BadRequestError(messages);
    }

    req[target] = value;
    next();
  };
}
