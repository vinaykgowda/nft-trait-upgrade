import { ReforgeOrderRepository, ReforgeOrderRow } from '@/lib/repositories/reforge-orders';
import { ReforgeOrder, ReforgeOrderStatus, ReforgeError } from '@/types/reforge';

/**
 * Valid state transitions for a Reforge Order:
 * - bought → started_reforge
 * - started_reforge → completed
 * - started_reforge → failed
 * - bought → failed
 */
const VALID_TRANSITIONS: Record<ReforgeOrderStatus, ReforgeOrderStatus[]> = {
  bought: ['started_reforge', 'failed'],
  started_reforge: ['completed', 'failed'],
  completed: [],
  failed: [],
};

export class ReforgeOrderManager {
  private repository: ReforgeOrderRepository;

  constructor(repository?: ReforgeOrderRepository) {
    this.repository = repository || new ReforgeOrderRepository();
  }

  /**
   * Validate whether a state transition is allowed.
   * Returns true if the transition from currentState to targetState is valid.
   */
  isValidTransition(currentState: ReforgeOrderStatus, targetState: ReforgeOrderStatus): boolean {
    const allowedTargets = VALID_TRANSITIONS[currentState];
    if (!allowedTargets) return false;
    return allowedTargets.includes(targetState);
  }

  /**
   * Transition an order to a new state.
   * Throws a ReforgeError with code 'INVALID_ORDER_STATE' if the transition is not permitted.
   */
  async transitionOrder(
    orderId: string,
    targetState: ReforgeOrderStatus,
    failureReason?: string
  ): Promise<ReforgeOrder> {
    const row = await this.repository.findById(orderId);
    if (!row) {
      throw this.createError(
        'ORDER_NOT_FOUND',
        `Order with id ${orderId} not found`
      );
    }

    const currentState = row.status as ReforgeOrderStatus;

    if (!this.isValidTransition(currentState, targetState)) {
      throw this.createError(
        'INVALID_ORDER_STATE',
        `Invalid state transition: cannot transition from '${currentState}' to '${targetState}'`
      );
    }

    const updatedRow = await this.repository.updateStatus(orderId, targetState, failureReason);
    if (!updatedRow) {
      throw this.createError(
        'ORDER_NOT_FOUND',
        `Order with id ${orderId} not found during update`
      );
    }

    return this.repository.toDomain(updatedRow);
  }

  /**
   * Get the list of valid target states from a given state.
   */
  getValidTargetStates(currentState: ReforgeOrderStatus): ReforgeOrderStatus[] {
    return VALID_TRANSITIONS[currentState] || [];
  }

  private createError(code: string, message: string, retryable: boolean = false): ReforgeError & Error {
    const error = new Error(message) as ReforgeError & Error;
    error.error = code;
    error.message = message;
    error.retryable = retryable;
    return error;
  }
}
