/**
 * Local augmentation for the packaged `@halo-dev/api-client` types.
 *
 * The client is distributed as a pre-built artifact
 * (`ui/halo-dev-api-client-*.tgz`) generated from the backend OpenAPI
 * contract, so it cannot be edited by hand. Until the contract ships the
 * variant purchase-limit fields, declare them here so the storefront can use
 * them in a type-safe way.
 *
 * Remove this file once `maxPerOrder` / `maxPerUser` are present in the
 * generated `ProductVariantResponse`.
 */
import '@halo-dev/api-client';

declare module '@halo-dev/api-client' {
  interface ProductVariantResponse {
    /**
     * Pricing mode of the variant: `FIXED` or `INQUIRY`.
     */
    pricingType?: 'FIXED' | 'INQUIRY' | null;
    /**
     * Max quantity of this variant allowed in one order. `null` = unlimited.
     */
    maxPerOrder?: number | null;
    /**
     * Max cumulative quantity per customer across orders. Enforced
     * server-side at checkout; the storefront only surfaces server errors.
     */
    maxPerUser?: number | null;
  }
}
