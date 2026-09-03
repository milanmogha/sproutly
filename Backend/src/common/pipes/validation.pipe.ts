import { ValidationPipe, ValidationPipeOptions } from '@nestjs/common';

/**
 * Pre-configured global validation pipe. Strips unknown properties,
 * transforms payloads into DTO instances and rejects extra fields.
 */
export const validationPipeOptions: ValidationPipeOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
};

export class AppValidationPipe extends ValidationPipe {
  constructor() {
    super(validationPipeOptions);
  }
}
