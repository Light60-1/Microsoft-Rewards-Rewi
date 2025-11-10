import type { Page } from 'playwright'
import type { MorePromotion, PromotionalItem } from './DashboardData'

/**
 * Activity handler contract for solving a single dashboard activity.
 * 
 * **Extensibility Pattern**: This interface allows developers to register custom activity handlers
 * for new or unsupported activity types without modifying the core Activities.ts dispatcher.
 * 
 * **Usage Example**:
 * ```typescript
 * class MyCustomHandler implements ActivityHandler {
 *   id = 'my-custom-handler'
 *   canHandle(activity) { return activity.name === 'special-promo' }
 *   async run(page, activity) { 
 *     // Custom logic here
 *   }
 * }
 * 
 * // In bot initialization:
 * bot.activities.registerHandler(new MyCustomHandler())
 * ```
 * 
 * **Notes**:
 * - Implementations should be stateless (or hold only a reference to the bot)
 * - The page is already navigated to the activity tab/window by the caller
 * - Custom handlers are checked BEFORE built-in handlers for maximum flexibility
 */
export interface ActivityHandler {
  /** Optional identifier used in logging output */
  id?: string
  /**
   * Return true if this handler knows how to process the given activity.
   */
  canHandle(activity: MorePromotion | PromotionalItem): boolean
  /**
   * Execute the activity on the provided page. The page is already
   * navigated to the activity tab/window by the caller.
   */
  run(page: Page, activity: MorePromotion | PromotionalItem): Promise<void>
}
