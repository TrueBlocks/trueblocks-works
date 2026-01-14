import { validation } from '@models';
import { notifications } from '@mantine/notifications';

/**
 * Display validation errors and warnings from a ValidationResult.
 * Returns true if there were errors, false if validation passed.
 */
export function showValidationResult(result: validation.ValidationResult): boolean {
  if (!result) return false;

  const hasErrors = result.errors && result.errors.length > 0;
  const hasWarnings = result.warnings && result.warnings.length > 0;

  if (hasErrors) {
    result.errors?.forEach((error) => {
      notifications.show({
        title: 'Validation Error',
        message: `${error.field}: ${error.message}`,
        color: 'red',
      });
    });
  }

  if (hasWarnings) {
    result.warnings?.forEach((warning) => {
      notifications.show({
        title: 'Warning',
        message: `${warning.field}: ${warning.message}`,
        color: 'yellow',
      });
    });
  }

  return hasErrors || false;
}
