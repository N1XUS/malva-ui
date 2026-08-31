import { MlvToastRef } from '@malva-ui/core/toast';

/**
 * Handle returned by `MlvNotificationService.show()` and
 * `MlvNotificationService.open()`.
 *
 * Component content can inject this class and template content receives it in
 * its context.
 *
 * @typeParam D - Type of the data supplied for this notification.
 */
export class MlvNotificationRef<D = unknown> extends MlvToastRef<D> {}
